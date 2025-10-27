import type { ImportedTransaction } from "@/store";

const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Housing",
  "Health & Fitness",
  "Entertainment & Leisure",
  "Financial Fees",
  "Virtual Account",
  "Other"
];

const INCOME_CATEGORIES = [
  "Salary / Wages",
  "Business Income",
  "Freelance / Side Hustle",
  "Investments",
  "Gifts & Transfers"
];

interface CategorizedTransaction {
  description: string;
  category: string;
}

/**
 * Categorize transactions using OpenAI
 * @param transactions Array of transactions to categorize
 * @returns Array of transactions with assigned categories
 */
export async function categorizeTransactionsWithAI(
  transactions: ImportedTransaction[]
): Promise<ImportedTransaction[]> {
  const apiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY as string | undefined;
  
  // Fallback to rule-based if no API key
  if (!apiKey) {
    return categorizeTransactionsRuleBased(transactions);
  }

  try {
    // Batch transactions in groups of 20 for efficiency
    const batchSize = 20;
    const batches: ImportedTransaction[][] = [];
    for (let i = 0; i < transactions.length; i += batchSize) {
      batches.push(transactions.slice(i, i + batchSize));
    }

    const categorizedBatches = await Promise.all(
      batches.map(batch => categorizeBatchWithAI(batch, apiKey))
    );

    return categorizedBatches.flat();
  } catch (error) {
    return categorizeTransactionsRuleBased(transactions);
  }
}

async function categorizeBatchWithAI(
  transactions: ImportedTransaction[],
  apiKey: string
): Promise<ImportedTransaction[]> {
  const transactionsToProcess = transactions.filter(t => !t.category);
  
  // If all already have categories, return as is
  if (transactionsToProcess.length === 0) {
    return transactions;
  }

  // Group by type
  const credits = transactionsToProcess.filter(t => t.type === 'credit');
  const debits = transactionsToProcess.filter(t => t.type === 'debit');

  const categorized = new Map<string, string>();

  // Categorize credits
  if (credits.length > 0) {
    const creditResults = await callOpenAI(
      credits.map(t => t.description),
      INCOME_CATEGORIES,
      'income',
      apiKey
    );
    creditResults.forEach((result) => {
      categorized.set(result.description, result.category);
    });
  }

  // Categorize debits
  if (debits.length > 0) {
    const debitResults = await callOpenAI(
      debits.map(t => t.description),
      EXPENSE_CATEGORIES,
      'expense',
      apiKey
    );
    debitResults.forEach((result) => {
      categorized.set(result.description, result.category);
    });
  }

  // Apply categorizations
  return transactions.map(t => {
    if (t.category) return t;
    const category = categorized.get(t.description);
    return { ...t, category: category || 'Other' };
  });
}

async function callOpenAI(
  descriptions: string[],
  categories: string[],
  type: 'income' | 'expense',
  apiKey: string
): Promise<CategorizedTransaction[]> {
  const systemPrompt = `You are a financial transaction categorizer. Given transaction descriptions from Indonesian bank statements, categorize them into one of the provided categories.

Available ${type} categories:
${categories.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Important categorization rules:
- "Virtual Account" is for transfers to e-wallets like GoPay, OVO, DANA (Transactions have to explicitly say those e-wallets name to be categorize into this category)
- "Food & Dining" includes restaurants, cafes, supermarkets, convenience stores (Indomaret, Alfamart)
- "Transport" includes Grab, Gojek, fuel, toll roads, public transportation
- "Shopping" includes e-commerce (Tokopedia, Shopee, Lazada), online/offline retail
- "Bills & Utilities" includes PLN (electricity), water, internet, phone bills
- "Financial Fees" includes bank fees, admin charges, transfer fees
- "Gifts & Transfers" (income) or "Other" (expense) for generic transfers

Return a JSON array of objects with "description" and "category" fields. Match descriptions exactly as provided.`;

  const userPrompt = `Categorize these transactions:\n${descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    
    // Handle different response formats
    const results = parsed.transactions || parsed.categorizations || parsed.results || [];
    
    // Validate and map results
    return descriptions.map((desc, idx) => {
      const result = results[idx] || results.find((r: any) => r.description === desc);
      const category = result?.category || 'Other';
      
      // Validate category exists in our list
      const validCategory = categories.includes(category) ? category : 'Other';
      
      return {
        description: desc,
        category: validCategory
      };
    });
  } catch (error) {
    // Fallback to "Other" for all
    return descriptions.map(desc => ({ description: desc, category: 'Other' }));
  }
}

/**
 * Rule-based categorization as fallback
 */
function categorizeTransactionsRuleBased(
  transactions: ImportedTransaction[]
): ImportedTransaction[] {
  return transactions.map(t => {
    if (t.category) return t;
    
    const desc = t.description.toLowerCase();
    let category = t.category;
    
    if (!category) {
      // Income categories
      if (/(salary|gaji|payroll|transfer.*(gaji|salary))/i.test(desc)) {
        category = 'Salary / Wages';
      }
      // Expense categories
      else if (/(gopay|ovo|dana|virtual account|va|top.?up|isi saldo)/i.test(desc)) {
        category = 'Virtual Account';
      }
      else if (/(indomaret|alfamart|supermarket|mini market|grocer|hypermart)/i.test(desc)) {
        category = 'Food & Dining';
      }
      else if (/(tokopedia|shopee|lazada|blibli|ecommerce|marketplace)/i.test(desc)) {
        category = 'Shopping';
      }
      else if (/(pln|pdam|electric| listrik |water|internet|indihome|first media|xl|telkomsel|telkom)/i.test(desc)) {
        category = 'Bills & Utilities';
      }
      else if (/(grab|gojek|transport|bus|train|travel|toll|tol|fuel|pertamina|spbu)/i.test(desc)) {
        category = 'Transport';
      }
      else if (/(hospital|clinic|apotek|pharmacy|doctor|dokter|bpjs)/i.test(desc)) {
        category = 'Health & Fitness';
      }
      else if (/(restaurant|cafe|coffee|mc ?donald|kfc|pizza|burger)/i.test(desc)) {
        category = 'Food & Dining';
      }
      else if (/(rent|sewa|kos| kontrakan |apartemen)/i.test(desc)) {
        category = 'Housing';
      }
      else if (/(education|tuition|school|kampus|course|kursus)/i.test(desc)) {
        category = 'Other';
      }
      else if (/(fee|biaya|admin|charges)/i.test(desc)) {
        category = 'Financial Fees';
      }
      else if (/(bca|bi-fast|trsf e-banking|transfer)/i.test(desc)) {
        category = t.type === 'credit' ? 'Gifts & Transfers' : 'Other';
      }
      else {
        category = 'Other';
      }
    }
    
    return { ...t, category };
  });
}

