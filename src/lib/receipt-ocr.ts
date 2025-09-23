export type ParsedReceiptItem = { name: string; price_cents: number };
export type ParsedReceipt = {
  items: ParsedReceiptItem[];
  tax_cents: number;
  rawText: string;
};

const parseCurrencyToCents = (raw: string): number => {
  const cleaned = raw
    .replace(/rp/gi, "")
    .replace(/idr/gi, "")
    .replace(/[^0-9,\.]/g, "")
    .trim();
  let digits = cleaned;
  if (cleaned.includes(".") && cleaned.includes(",")) {
    digits = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    digits = cleaned.replace(/,/g, "");
  } else {
    digits = cleaned.replace(/\./g, "");
  }
  const value = Number.parseFloat(digits || "0");
  return Math.round((isFinite(value) ? value : 0) * 100);
};

const rejectLine = (line: string) => {
  const rejectRe = /^(qty\s+item\s+total|subtotal|net\s*sales|total|take[- ]?out|cash\s+tendered|cash|change|kembalian|tendered|card|crew|store|npwp|tax\s*invoice|mcdonald|pt\.|ord|reg|tax\s*invoice)/i;
  const modifierRe = /^[-•]|^(no\s|extra\s|less\s)/i;
  return rejectRe.test(line) || modifierRe.test(line);
};

export const parseReceiptTextToItems = (text: string): ParsedReceiptItem[] => {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: ParsedReceiptItem[] = [];
  for (const raw of lines) {
    if (rejectLine(raw)) continue;
    const line = raw.replace(/\s{2,}/g, " ").trim();
    let match = line.match(/^\d+\s+(.+?)\s+([0-9\.,]+)$/);
    if (!match) match = line.match(/(.+?)\s+([0-9\.,]+)$/);
    if (match) {
      let name = match[1].replace(/x\d+$/i, "").trim();
      if (/sauce|ketchup|mustard|pickle|slice/i.test(name)) continue;
      const cents = parseCurrencyToCents(match[2]);
      if (name && cents > 0) results.push({ name, price_cents: cents });
    }
  }

  if (results.length === 0) {
    for (const raw of lines) {
      if (rejectLine(raw)) continue;
      const m = raw.match(/([0-9\.,]+)/);
      if (m) {
        const cents = parseCurrencyToCents(m[1]);
        const name = raw.replace(m[0], "").trim();
        if (name && cents > 0) results.push({ name, price_cents: cents });
      }
    }
  }
  // Heuristic: some OCR pipelines output amounts in cents already multiplied by 100.
  // Per user request, normalize by dividing by 100.
  const normalized = results.map((r) => ({ ...r, price_cents: Math.round(r.price_cents) }));
  return normalized.slice(0, 100);
};

export const parseReceiptTextForTax = (text: string, subtotalCents: number): number => {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  for (const line of lines) {
    if (!/(ppn|tax|pajak|service)/i.test(line)) continue;
    const mAmt = line.match(/([0-9\.,]+)\s*$/);
    if (mAmt) {
      const cents = parseCurrencyToCents(mAmt[1]);
      if (cents > 0) return cents;
    }
  }
  for (const line of lines) {
    const mPct = line.match(/(ppn|tax|pajak)[^\d]*([0-9]{1,2})\s*%/i);
    if (mPct) {
      const pct = parseInt(mPct[2], 10);
      if (pct > 0 && subtotalCents > 0) return Math.round((subtotalCents * pct) / 100);
    }
  }
  return 0;
};

export async function parseReceiptImage(dataUrl: string): Promise<ParsedReceipt> {
  const apiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY as string | undefined;
  if (!apiKey) {
    // Without API key we cannot proceed as requested (OCR disabled)
    return { items: [], tax_cents: 0, rawText: "" };
  }

  const parsed = await aiExtractFromImage(dataUrl, apiKey);
  let items = (parsed?.items || []).map((it) => ({
    name: String(it.name || "").trim(),
    // Do NOT divide here; model already returns cents
    price_cents: Math.round(Number(it.price_cents || 0)),
  }));
  // Heuristic: if model accidentally returned rupiah (not cents), values will be too small (e.g., 45000 -> 45000 cents expected; 450 seen).
  // If max < 1000 and there is at least one > 0, treat values as rupiah and multiply by 100.
  const maxVal = items.reduce((m, i) => Math.max(m, i.price_cents || 0), 0);
  const hasPositive = items.some((i) => (i.price_cents || 0) > 0);
  if (hasPositive && maxVal > 0 && maxVal < 1000) {
    items = items.map((i) => ({ ...i, price_cents: Math.round((i.price_cents || 0) * 100) }));
  }
  // Ignore AI tax; we will handle tax based on user selection in the UI
  const tax_cents = 0;

  return { items, tax_cents, rawText: "" };
}

async function aiExtractFromImage(dataUrl: string, apiKey: string): Promise<{ items: { name: string; price_cents: number }[]; tax_cents?: number } | null> {
  try {
    const body = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a precise receipt parser. If the image is tilted or rotated, conceptually analyze it across multiple orientations (≈0°-90°) and choose the interpretation that yields consistent items and totals. For each purchasable item line, use the RIGHTMOST numeric amount on that line as the item's price. Do NOT multiply by quantities (e.g., '1 x', '2 pcs'); treat those as descriptors only. Exclude headers and totals: SUBTOTAL, TOTAL, CASH, CHANGE, TAX LINES, and modifiers/options like sauces. Return STRICT JSON only: { items:[{name, price_cents}], tax_cents }. name is concise; price_cents is integer IDR cents (Rp 45.000 => 45000).",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract items and tax. Only return JSON as specified." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 800,
    } as any;
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    const content: string = json.choices?.[0]?.message?.content || "";
    const safe = content && content.trim().startsWith("{") ? content : (json.choices?.[0]?.message?.content ?? "{}");
    const parsed = JSON.parse(safe);
    return parsed;
  } catch {
    // Retry once with a stricter instruction
    try {
      const body = {
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          { role: "system", content: "Return JSON only: { items:[{name, price_cents}], tax_cents }. If rotated/tilted, mentally examine 0°–90° orientations and pick the best reading. Use RIGHTMOST number as price; do NOT multiply by 'x' or 'pcs'. Exclude subtotal/total/cash/change/tax lines and modifiers/options." },
          { role: "user", content: [ { type: "text", text: "Parse this receipt image." }, { type: "image_url", image_url: { url: dataUrl } } ] }
        ]
      } as any;
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      const content: string = json.choices?.[0]?.message?.content || "";
      const parsed = JSON.parse(content);
      return parsed;
    } catch {
      return null;
    }
  }
}


