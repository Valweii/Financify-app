import type { ImportedTransaction } from "@/store";

// Lightweight text extractor using pdfjs-dist with optional OCR fallback via tesseract.js
// The BCA statement format has rows like:
// 01/08  TRSF E-BANKING DB  ... 98,000.00  DB   28,964,344.49
// We'll parse by scanning for date tokens (dd/mm), aggregating description text
// until we find an amount followed by DB/CR.

// pdfjs-dist worker setup for Vite
import { GlobalWorkerOptions, getDocument, type TextItem } from "pdfjs-dist";
// Use Vite's ?url to load the worker asset
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite will resolve the URL at build time
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl as unknown as string;

function idrToCents(amountIdr: number): number {
  // Represent IDR in cents for internal consistency
  return Math.round(amountIdr * 100);
}

function parseAmountToIdr(raw: string): number | null {
  // Normalize Indonesian-format numbers like 3,000.00 or 3.000,00
  const cleaned = raw
    .replace(/[^0-9,\.]/g, "")
    .trim();
  if (!cleaned) return null;
  // Prefer last separator as decimal mark
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalPos = Math.max(lastComma, lastDot);
  let integerPart = cleaned;
  if (decimalPos !== -1) {
    integerPart = cleaned.slice(0, decimalPos);
  }
  // Remove thousand separators
  const normalized = integerPart.replace(/[\.,]/g, "");
  if (!normalized) return null;
  return parseInt(normalized, 10);
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);
}

// Core text parsing for BCA statements
export function parseBcaStatementText(text: string): ImportedTransaction[] {
  const lines = splitLines(text);
  const transactions: ImportedTransaction[] = [];

  // Regexes
  const dateRe = /^(\d{2})\/(\d{2})/; // dd/mm
  const amountRe = /([0-9][0-9\.,]*)\s*(DB|CR)\b/i;

  let buffer: { date?: string; parts: string[] } | null = null;

  const flushBuffer = () => {
    if (!buffer) return;
    const joined = buffer.parts.join(" ");
    const match = joined.match(amountRe);
    if (!match) {
      buffer = null;
      return;
    }
    const rawAmount = match[1];
    const typeToken = match[2].toUpperCase();
    const amountIdr = parseAmountToIdr(rawAmount);
    if (amountIdr == null) {
      buffer = null;
      return;
    }
    // Description: remove trailing amount and DB/CR tokens
    const description = joined
      .replace(amountRe, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    transactions.push({
      date: toIsoDate(buffer.date!),
      description,
      type: typeToken === "CR" ? "credit" : "debit",
      // Amounts extracted from BCA statements are in IDR with two trailing decimals.
      // Our previous conversion to cents over-counted by 100. Normalize by dividing by 100.
      amount_cents: Math.round(idrToCents(amountIdr) / 100),
    });
    buffer = null;
  };

  for (const line of lines) {
    // Ignore header/footer noise
    if (/^REKENING TAHAPAN/i.test(line)) continue;
    if (/^KCU\s+/i.test(line)) continue;
    if (/^NO\. REKENING/i.test(line)) continue;
    if (/^CATATAN/i.test(line)) continue;
    if (/^TANGGAL\b/i.test(line)) continue;
    if (/^Bersambung/i.test(line)) continue;
    if (/^SALDO AWAL/i.test(line)) continue;

    const d = line.match(dateRe);
    if (d) {
      // Starting a new row; flush previous
      flushBuffer();
      const dd = d[1];
      const mm = d[2];
      const date = `${dd}/${mm}`;
      const rest = line.replace(dateRe, "").trim();
      buffer = { date, parts: [rest] };
      continue;
    }

    if (buffer) {
      buffer.parts.push(line);
      // If line contains amount + DB/CR, flush now
      if (amountRe.test(line)) {
        flushBuffer();
      }
    }
  }

  // Flush any dangling buffer
  flushBuffer();

  return transactions;
}

function toIsoDate(ddmm: string): string {
  // dd/mm without year -> infer year from current context: choose the most recent occurrence
  const [dd, mm] = ddmm.split("/");
  const now = new Date();
  const year = now.getFullYear();
  // If month appears to be in the future relative to now (e.g., statement from last month),
  // prefer current year still — users can adjust later if needed.
  const iso = new Date(`${year}-${mm}-${dd}T00:00:00.000Z`).toISOString();
  return iso;
}

async function extractTextWithPdfJs(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  const doc = await getDocument({ data }).promise;
  let fullText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as TextItem[])
      .map((it) => ("str" in it ? (it as unknown as { str: string }).str : ""))
      .join("\n");
    fullText += pageText + "\n";
  }
  return fullText;
}

async function ocrPdfIfNeeded(file: File): Promise<string> {
  // Render each page to canvas and OCR with Tesseract only when text extraction is empty
  const data = await file.arrayBuffer();
  const doc = await getDocument({ data }).promise;
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    let fullText = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) continue;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context as unknown as CanvasRenderingContext2D, viewport }).promise;
      const { data: result } = await worker.recognize(canvas);
      fullText += result.text + "\n";
    }
    return fullText;
  } finally {
    await worker.terminate();
  }
}

export async function parseBcaStatementPdf(file: File): Promise<ImportedTransaction[]> {
  let text = await extractTextWithPdfJs(file);
  if (!text || text.trim().length < 50) {
    // Fallback to OCR for image-only PDFs
    text = await ocrPdfIfNeeded(file);
  }
  return parseBcaStatementText(text);
}


