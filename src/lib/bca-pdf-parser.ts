import type { ImportedTransaction } from "@/store";

// Enhanced BCA statement parser with robust multiline handling and format detection
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";

// Vite worker setup
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite will resolve the URL at build time
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl as unknown as string;

interface TransactionBuffer {
  date: string;
  lines: string[];
  isComplete: boolean;
}

// Enhanced amount parsing for Indonesian format
function parseAmountToIdr(raw: string): number | null {
  if (!raw) return null;
  
  // Clean the raw string - keep only digits, commas, and dots
  const cleaned = raw
    .replace(/[^\d,\.]/g, "")
    .trim();
    
  if (!cleaned || cleaned === "0" || cleaned === "0.00") return null;
  
  // Handle Indonesian format: comma as thousand separator, dot as decimal
  // Examples: 21,000.00, 1,500,000.00, 500.00
  try {
    // Split on dot to separate decimal part
    const parts = cleaned.split('.');
    
    if (parts.length === 2) {
      const integerPart = parts[0].replace(/,/g, ''); // Remove thousand separators
      const decimalPart = parts[1].padEnd(2, '0').substring(0, 2); // Ensure 2 decimal places
      
      const fullNumber = parseFloat(`${integerPart}.${decimalPart}`);
      return Math.round(fullNumber);
    } else if (parts.length === 1) {
      // No decimal part - treat as whole rupiah
      const integerPart = cleaned.replace(/,/g, '');
      const fullNumber = parseInt(integerPart, 10);
      return fullNumber;
    }
    
    return null;
  } catch (error) {
    console.warn(`Failed to parse amount: "${raw}"`, error);
    return null;
  }
}

// Enhanced line filtering and preprocessing
function preprocessLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    // Remove obvious header/footer patterns
    .filter(line => !isIgnorableLine(line));
}

// Comprehensive line filtering
function isIgnorableLine(line: string): boolean {
  const ignorablePatterns = [
    // Headers and metadata
    /^REKENING TAHAPAN/i,
    /^KCU\s+/i,
    /^KANTOR CABANG/i,
    /^NO\.\s*REKENING/i,
    /^HALAMAN/i,
    /^PERIODE/i,
    /^MATA UANG/i,
    /^CATATAN/i,
    /^NOTES/i,
    
    // Table headers
    /^TANGGAL\s+KETERANGAN/i,
    /^DATE\s+DESCRIPTION/i,
    /^TANGGAL\s*$/i,
    /^KETERANGAN\s*$/i,
    /^CBG\s*$/i,
    /^MUTASI\s*$/i,
    /^SALDO\s*$/i,
    
    // Page continuation
    /^Bersambung/i,
    /^Continued/i,
    /^Sambungan/i,
    
    // Table separators and formatting
    /^[-\s]+$/,
    /^[=\s]+$/,
    /^\*+$/,
    
    // Summary section identifiers (we'll handle these separately)
    /^JUMLAH MUTASI/i,
    /^TOTAL MUTATION/i,
  ];
  
  return ignorablePatterns.some(pattern => pattern.test(line));
}

// Check if line is a summary/balance entry that shouldn't be treated as a transaction
function isSummaryLine(line: string): boolean {
  const summaryPatterns = [
    /^SALDO AWAL\b/i,
    /^OPENING BALANCE\b/i,
    /^SALDO AKHIR\b/i,
    /^CLOSING BALANCE\b/i,
    /^MUTASI\s+(DB|CR)\b/i, // More specific: MUTASI followed by DB/CR
    // /^TOTAL MUTATION\b/i,
    // /^BUNGA\b/i,
    // /^INTEREST\b/i,
    // /^PAJAK BUNGA\b/i,
    // /^TAX ON INTEREST\b/i,
    // /^BIAYA ADM\b/i,
    // /^ADMIN FEE\b/i,
  ];
  
  return summaryPatterns.some(pattern => pattern.test(line));
}

// Enhanced date detection
function extractDateFromLine(line: string): string | null {
  // Match dd/mm format at start of line
  const dateMatch = line.match(/^(\d{1,2})\/(\d{1,2})\b/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    return `${day}/${month}`;
  }
  return null;
}

// Enhanced transaction detection and parsing
function parseTransactionFromBuffer(buffer: TransactionBuffer): ImportedTransaction | null {
  if (!buffer.date || buffer.lines.length === 0) return null;
  
  const fullText = buffer.lines.join(' ').replace(/\s+/g, ' ').trim();
  
  // Skip summary lines
  if (isSummaryLine(fullText)) return null;
  
  // Enhanced amount detection patterns
  const amountPatterns = [
    // Debit: amount followed by DB, optionally followed by saldo
    /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*DB(?:\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?))?/i,
    // Credit: amount followed by CR, optionally followed by saldo
    /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*CR(?:\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?))?/i,
    // Credit without CR indicator: amount at end of line (after description) followed by saldo
    /\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*$/,
    // Credit: amount at end of line without saldo (common for credit transactions)
    // Use a more specific pattern to avoid matching partial amounts
    /(\d{2,}(?:,\d{3})*(?:\.\d{2})?)\s*$/,
    // Credit: amount in middle of line followed by reference number (e.g., "41000.00 3008/FTSCY/WS95031")
    /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s+(?=\d{4}\/\w+)/,
    // Credit: amount in middle of line (look for larger amounts, not small numbers like dates)
    /(\d{2,}(?:,\d{3})*(?:\.\d{2})?)\s+(?=.*[A-Za-z])/,
  ];
  
  for (let i = 0; i < amountPatterns.length; i++) {
    const pattern = amountPatterns[i];
    const match = fullText.match(pattern);
    
    if (match) {
      const amountStr = match[1];
      const amount = parseAmountToIdr(amountStr);
      
      if (amount === null || amount === 0) continue;
      
      // Determine transaction type
      let type: 'debit' | 'credit';
      if (i === 0) { // DB pattern
        type = 'debit';
      } else if (i === 1) { // CR pattern
        type = 'credit';
      } else { // Amount without explicit DB/CR
        // For patterns 2, 3, 4: assume credit unless context suggests otherwise
        // Check if description contains debit indicators
        const desc = fullText.toLowerCase();
        if (desc.includes('debit') || desc.includes('withdraw') || desc.includes('payment')) {
          type = 'debit';
        } else {
          type = 'credit';
        }
      }
      
      // Extract description by removing the amount pattern from the text
      let description = fullText.replace(pattern, '').trim();
      
      // Clean up description
      description = description
        .replace(/\s{2,}/g, ' ') // Normalize whitespace
        .replace(/^[\/\-\s]+|[\/\-\s]+$/g, '') // Remove leading/trailing separators
      .trim();

      // Skip if description is too short or seems invalid
      if (description.length < 2) return null;
      
      return {
        date: toIsoDate(buffer.date),
      description,
        type,
        amount_cents: amount,
      };
    }
  }
  
  return null;
}

// Enhanced date conversion with better year inference
function toIsoDate(ddmm: string): string {
  const [day, month] = ddmm.split('/').map(part => part.padStart(2, '0'));
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() is 0-indexed
  
  // Smart year inference:
  // If the statement month is more than 6 months in the future, assume it's from last year
  const statementMonth = parseInt(month, 10);
  let year = currentYear;
  
  if (statementMonth > currentMonth + 6) {
    year = currentYear - 1;
  }
  
  try {
    const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    return date.toISOString();
  } catch (error) {
    // Fallback to current year if date construction fails
    console.warn(`Invalid date: ${day}/${month}/${year}, using current year`);
    return new Date(`${currentYear}-${month}-${day}T00:00:00.000Z`).toISOString();
  }
}

// Enhanced text parsing with better multiline handling
export function parseBcaStatementText(text: string): ImportedTransaction[] {
  const lines = preprocessLines(text);
  const transactions: ImportedTransaction[] = [];

  let currentBuffer: TransactionBuffer | null = null;
  
  const processBuffer = () => {
    if (currentBuffer) {
      const transaction = parseTransactionFromBuffer(currentBuffer);
      if (transaction) {
        transactions.push(transaction);
      }
      currentBuffer = null;
    }
  };

  for (const line of lines) {
    // Check for date pattern to start new transaction
    const date = extractDateFromLine(line);
    
    if (date) {
      // Process previous buffer before starting new one
      processBuffer();
      
      // Start new transaction buffer
      const remainingLine = line.replace(/^\d{1,2}\/\d{1,2}\s*/, '').trim();
      currentBuffer = {
        date,
        lines: remainingLine ? [remainingLine] : [],
        isComplete: false
      };
    } else if (currentBuffer) {
      // Add line to current transaction buffer
      currentBuffer.lines.push(line);
      
      // Check if this line completes the transaction (contains amount + DB/CR or final amount)
      const hasAmount = /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(DB|CR)?/i.test(line);
      const hasAmountAtEnd = /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*$/.test(line);
      const hasLargeAmount = /(\d{2,}(?:,\d{3})*(?:\.\d{2})?)\s+(?=.*[A-Za-z])/.test(line);
      
      if (hasAmount || hasAmountAtEnd || hasLargeAmount) {
        currentBuffer.isComplete = true;
        processBuffer();
      }
    }
    // If no current buffer and no date, skip line (it's probably noise)
  }
  
  // Process any remaining buffer
  processBuffer();
  
  // Post-process: filter out duplicates and invalid transactions
  return transactions
    // .filter((t, index, arr) => {
    //   // Remove duplicates based on date + description + amount
    //   const key = `${t.date}-${t.description}-${t.amount_cents}`;
    //   return arr.findIndex(other => 
    //     `${other.date}-${other.description}-${other.amount_cents}` === key
    //   ) === index;
    // })
    .filter(t => 
      t.amount_cents > 0 && 
      t.description.length > 2 &&
      !isSummaryLine(t.description)
    );
}

// Enhanced PDF text extraction with better error handling
async function extractTextWithPdfJs(file: File): Promise<string> {
  try {
  const data = await file.arrayBuffer();
  const doc = await getDocument({ data }).promise;
    
  let fullText = "";
    
  for (let i = 1; i <= doc.numPages; i++) {
      try {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
        
        // More sophisticated text extraction that preserves layout
        const pageItems = content.items
          .filter((item): item is any => 'str' in item && item.str.trim().length > 0)
          .sort((a, b) => {
            // Sort by y-coordinate (top to bottom), then x-coordinate (left to right)
            const yDiff = Math.round(b.transform[5]) - Math.round(a.transform[5]);
            if (Math.abs(yDiff) > 2) return yDiff;
            return Math.round(a.transform[4]) - Math.round(b.transform[4]);
          });
        
        let currentY = null;
        let currentLine = [];
        
        for (const item of pageItems) {
          const y = Math.round(item.transform[5]);
          const text = item.str.trim();
          
          if (currentY === null || Math.abs(y - currentY) <= 2) {
            // Same line
            currentLine.push(text);
            currentY = y;
          } else {
            // New line
            if (currentLine.length > 0) {
              fullText += currentLine.join(' ') + '\n';
            }
            currentLine = [text];
            currentY = y;
          }
        }
        
        // Add final line
        if (currentLine.length > 0) {
          fullText += currentLine.join(' ') + '\n';
        }
        
        fullText += '\n'; // Page separator
      } catch (pageError) {
        console.warn(`Error processing page ${i}:`, pageError);
      }
    }
    
  return fullText;
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

// Enhanced OCR fallback with proper PSM enum import
async function ocrPdfIfNeeded(file: File): Promise<string> {
  try {
  const data = await file.arrayBuffer();
  const doc = await getDocument({ data }).promise;
    
    const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng");
    
    // Configure Tesseract for better bank statement recognition with proper PSM enum
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,/:-()',
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });
    
  try {
    let fullText = "";
      
    for (let i = 1; i <= doc.numPages; i++) {
        try {
      const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
          
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) continue;
          
      canvas.width = viewport.width;
      canvas.height = viewport.height;
          
          await page.render({ 
            canvasContext: context as unknown as CanvasRenderingContext2D, 
            viewport 
          }).promise;
          
      const { data: result } = await worker.recognize(canvas);
      fullText += result.text + "\n";
        } catch (pageError) {
          console.warn(`Error OCR processing page ${i}:`, pageError);
        }
    }
      
    return fullText;
  } finally {
    await worker.terminate();
    }
  } catch (error) {
    console.error('OCR processing failed:', error);
    throw new Error('Failed to perform OCR on PDF');
  }
}

// Main parser function with enhanced error handling and fallbacks
export async function parseBcaStatementPdf(file: File): Promise<ImportedTransaction[]> {
  try {
    // First attempt: extract text directly from PDF
  let text = await extractTextWithPdfJs(file);
    
    // Check if extracted text is substantial enough
    const meaningfulText = text.replace(/\s+/g, ' ').trim();
    
    if (!meaningfulText || meaningfulText.length < 100) {
      console.warn('Insufficient text extracted, falling back to OCR');
    text = await ocrPdfIfNeeded(file);
  }
    
    // Parse the extracted text
    const transactions = parseBcaStatementText(text);
    
    if (transactions.length === 0) {
      console.warn('No transactions found in parsed text. Text sample:', text.substring(0, 500));
    }
    
    return transactions;
  } catch (error) {
    console.error('BCA statement parsing failed:', error);
    throw new Error(`Failed to parse BCA statement: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}