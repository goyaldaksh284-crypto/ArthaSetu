/**
 * Shared text -> transaction extraction logic.
 *
 * Used by both the image scanner (OCR text from a receipt) and the voice
 * input (speech transcript), so both input methods parse identically.
 * This replaces the previous behaviour of injecting fake hardcoded
 * transactions when the Python parser server was unreachable.
 */

export type TransactionType = "income" | "expense";

export interface ExtractedTransaction {
  amount: number | null;
  type: TransactionType;
  category: string;
  merchant: string;
  description: string;
  paymentMethod: string;
  /** YYYY-MM-DD, or null when not mentioned */
  date: string | null;
  /** HH:MM (24h), or null when not mentioned */
  time: string | null;
  /** 0 - 1 */
  confidence: number;
}

/** Categories must match the options offered by TransactionInputCard's manual form. */
const EXPENSE_CATEGORIES: Record<string, string[]> = {
  Food: [
    "food", "restaurant", "cafe", "coffee", "tea", "lunch", "dinner", "breakfast",
    "snack", "meal", "swiggy", "zomato", "pizza", "burger", "domino", "mcdonald",
    "kfc", "starbucks", "dhaba", "canteen", "hotel", "bakery", "juice", "eats",
  ],
  Fuel: [
    "fuel", "petrol", "diesel", "cng", "petrol pump", "gas station", "indian oil",
    "iocl", "hpcl", "bpcl", "hp petro", "shell",
  ],
  Rent: ["rent", "rental", "landlord", "tenant", "lease"],
  Groceries: [
    "grocery", "groceries", "supermarket", "kirana", "dmart", "big bazaar", "bigbasket",
    "blinkit", "zepto", "instamart", "vegetable", "fruit", "milk", "atta", "rice",
    "provision", "store",
  ],
  Maintenance: [
    "maintenance", "repair", "servicing", "service centre", "garage", "mechanic",
    "plumber", "electrician", "paint", "carpenter", "fix",
  ],
  Phone: [
    "recharge", "mobile", "phone", "airtel", "jio", "vodafone", "vi ", "bsnl",
    "telecom", "sim", "broadband", "wifi", "internet", "dth",
  ],
  EMI: ["emi", "installment", "instalment", "loan", "mortgage", "credit card bill"],
};

const INCOME_CATEGORIES: Record<string, string[]> = {
  Salary: ["salary", "payroll", "paycheck", "wages", "stipend", "monthly pay"],
  Delivery: [
    "uber", "ola", "rapido", "swiggy", "zomato", "delivery", "ride", "driver",
    "trip", "parcel", "courier",
  ],
  Freelance: ["freelance", "client", "project", "consultancy", "gig", "contract", "invoice"],
};

const INCOME_KEYWORDS = [
  "received", "credited", "credit of", "salary", "earned", "earnings", "refund",
  "cashback", "income", "deposit", "got paid", "payment received", "won", "bonus",
];

const EXPENSE_KEYWORDS = [
  "spent", "paid", "pay", "bought", "purchase", "purchased", "ordered", "order",
  "bill", "invoice", "recharge", "total", "amount", "cost", "price", "debit",
  "swiped", "txn", "transaction",
];

const PAYMENT_METHODS = ["UPI", "Cash", "Card", "Bank Transfer"] as const;

const KNOWN_MERCHANTS = [
  "swiggy", "zomato", "uber", "ola", "rapido", "amazon", "flipkart", "myntra",
  "dmart", "big bazaar", "bigbasket", "blinkit", "zepto", "instamart", "reliance",
  "dominos", "mcdonald", "kfc", "starbucks", "indian oil", "hp petrol", "bharat petroleum",
  "airtel", "jio", "vodafone", "bsnl", "tata", "dunzo", "big c", "more supermarket",
];

// ---------------------------------------------------------------------------
// Number words (for voice input: "two hundred and fifty rupees")
// ---------------------------------------------------------------------------

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100, thousand: 1000, lakh: 100000, lac: 100000, crore: 10000000,
};

function wordsToNumber(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let sawAny = false;
  for (const w of words) {
    const v = NUMBER_WORDS[w];
    if (v === undefined) return null;
    sawAny = true;
    if (v === 100) {
      current = (current || 1) * 100;
    } else if (v === 1000 || v === 100000 || v === 10000000) {
      total += (current || 1) * v;
      current = 0;
    } else {
      current += v;
    }
  }
  if (!sawAny) return null;
  return total + current;
}

/**
 * Replace spelled-out amounts ("two hundred and fifty rupees") with digits
 * ("250 rupees") so the numeric patterns below can pick them up. Spoken
 * transcripts rarely contain numerals, receipts always do.
 */
function normalizeSpokenNumbers(text: string): string {
  const numberWord = Object.keys(NUMBER_WORDS).join("|");
  // "two hundred and fifty" | "twenty-five" | "two thousand five hundred"
  const phraseRe = new RegExp(
    `\\b(?:${numberWord})(?:(?:\\s+and\\s+|\\s*&\\s*|\\s+|\\-)(?:${numberWord}))+\\b`,
    "gi",
  );
  return text.replace(phraseRe, (phrase) => {
    const parts = (phrase.toLowerCase().match(/[a-z]+/g) || []).filter((w) => w in NUMBER_WORDS);
    const num = wordsToNumber(parts);
    return num === null ? phrase : String(num);
  });
}

// ---------------------------------------------------------------------------
// Amount
// ---------------------------------------------------------------------------

interface AmountCandidate {
  value: number;
  weight: number;
}

function parseNumeric(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 && n < 100000000 ? n : null;
}

function findAmount(text: string): AmountCandidate | null {
  const candidates: AmountCandidate[] = [];
  const push = (raw: string | undefined, weight: number) => {
    if (!raw) return;
    const value = parseNumeric(raw);
    if (value !== null) candidates.push({ value, weight });
  };

  // Indian receipt style: 500/-
  push(text.match(/(?:₹|\brs\.?|\binr)?\s*([\d,]+(?:\.\d{1,2})?)\s*\/-/i)?.[1], 0.95);
  // Currency symbol/prefix: ₹425 | Rs. 425 | INR 425
  push(text.match(/(?:₹|\brs\.?|\binr)\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1], 1);
  // Currency suffix: 425 rupees | 425 rs | 425 bucks
  push(text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|inr|bucks)\b/i)?.[1], 1);
  // Labelled amounts: total: 425 | amount paid 425 | grand total 425
  push(text.match(/(?:grand\s+total|net\s+(?:payable|amount)|total\s+amount|net\s+total)\D{0,15}([\d,]+(?:\.\d{1,2})?)/i)?.[1], 0.95);
  push(text.match(/\b(?:total|amount|paid|spent|cost|bill|pay|cash|upi)\b\D{0,15}([\d,]+(?:\.\d{1,2})?)/i)?.[1], 0.8);
  push(text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:paid|spent|recharged|debited|credited)/i)?.[1], 0.8);
  // Decimal number on its own (receipt totals usually carry paise)
  push(text.match(/(?:^|\s)([\d,]+\.\d{2})(?:\s|$)/)?.[1], 0.55);
  // Last resort: largest bare integer
  const bare = text.match(/(?:^|\s)(\d{2,6})(?:\s|$)/g);
  if (bare) {
    for (const m of bare) {
      push(m.trim(), 0.3);
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.weight - a.weight || b.value - a.value);
  return candidates[0];
}

// ---------------------------------------------------------------------------
// Date / time
// ---------------------------------------------------------------------------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toISODate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function findDate(text: string): string | null {
  const lower = text.toLowerCase();
  const today = new Date();

  if (/\bday before yesterday\b/.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() - 2);
    return d.toISOString().split("T")[0];
  }
  if (/\byesterday\b/.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }
  if (/\btoday\b|\bjust now\b/.test(lower)) {
    return today.toISOString().split("T")[0];
  }

  // 12/09/2026 | 12-09-26 | 12.09.2026 (Indian DD/MM assumption)
  const numeric = text.match(/\b(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?\b/);
  if (numeric) {
    let day = Number(numeric[1]);
    let month = Number(numeric[2]);
    if (month > 12 && day <= 12) {
      // Was actually MM/DD — swap
      [day, month] = [month, day];
    }
    let year = numeric[3] ? Number(numeric[3]) : today.getFullYear();
    if (year < 100) year += 2000;
    const iso = toISODate(year, month, day);
    if (iso) return iso;
  }

  // 12 Sep 2026 | Sep 12
  const monthRe = MONTHS.join("|");
  const dMon = text.match(new RegExp(`\\b(\\d{1,2})\\s*(?:st|nd|rd|th)?\\s+(${monthRe})[a-z]*(?:\\s+(\\d{2,4}))?\\b`, "i"));
  const monD = text.match(new RegExp(`\\b(${monthRe})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s+(\\d{2,4}))?\\b`, "i"));
  const m = dMon || monD;
  if (m) {
    const day = Number(dMon ? m[1] : m[2]);
    const month = MONTHS.indexOf((dMon ? m[2] : m[1]).toLowerCase()) + 1;
    let year = m[3] ? Number(m[3]) : today.getFullYear();
    if (year < 100) year += 2000;
    const iso = toISODate(year, month, day);
    if (iso) return iso;
  }

  return null;
}

function findTime(text: string): string | null {
  const t = text.match(/\b(\d{1,2})[:.](\d{2})\s*(a\.?m\.?|p\.?m\.?)?\b/i);
  if (t) {
    let hours = Number(t[1]);
    const minutes = Number(t[2]);
    const meridiem = (t[3] || "").toLowerCase().replace(/\./g, "");
    if (minutes > 59 || hours > 24) return null;
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
    if (hours > 23) return null;
    return `${pad(hours)}:${pad(minutes)}`;
  }
  const t2 = text.match(/\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)\b/i);
  if (t2) {
    let hours = Number(t2[1]);
    if (hours > 12) return null;
    if (t2[2].toLowerCase().startsWith("p") && hours < 12) hours += 12;
    if (t2[2].toLowerCase().startsWith("a") && hours === 12) hours = 0;
    return `${pad(hours)}:00`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Other fields
// ---------------------------------------------------------------------------

function findType(text: string): TransactionType {
  const lower = text.toLowerCase();
  if (INCOME_KEYWORDS.some((k) => lower.includes(k))) return "income";
  return "expense";
}

function findCategory(text: string, type: TransactionType): string {
  const lower = ` ${text.toLowerCase()} `;
  const map = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  let best: { category: string; length: number } | null = null;
  for (const [category, keywords] of Object.entries(map)) {
    for (const kw of keywords) {
      if (lower.includes(kw) && (!best || kw.length > best.length)) {
        best = { category, length: kw.length };
      }
    }
  }
  return best ? best.category : type === "income" ? "Other" : "Misc";
}

function findPaymentMethod(text: string): string {
  const lower = text.toLowerCase();
  if (/\bupi\b|gpay|google ?pay|phonepe|phone ?pe|paytm|bhim|\bqr\b|scan/.test(lower)) return "UPI";
  if (/neft|imps|rtgs|net ?banking|bank transfer|wire transfer/.test(lower)) return "Bank Transfer";
  if (/\bcash\b/.test(lower)) return "Cash";
  if (/\bcard\b|debit card|credit card|visa|mastercard|rupay|swiped/.test(lower)) return "Card";
  return "";
}

/** Words that show up in receipts/commands but are never a merchant name. */
const MERCHANT_STOPWORDS = new Set([
  "total", "amount", "cash", "date", "time", "gst", "bill", "invoice", "paid",
  "upi", "store", "counter", "thank", "thanks", "change", "subtotal", "tax",
  "item", "items", "qty", "price", "net", "pay", "card", "cashier", "customer",
  "order", "table", "waiter", "token", "receipt", "refund", "the", "and", "for",
]);

function findMerchant(text: string): string {
  const lower = text.toLowerCase();
  for (const brand of KNOWN_MERCHANTS) {
    if (lower.includes(brand)) {
      const match = text.match(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
      const name = match ? match[0] : brand;
      return name.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  // "at Hotel Grand" | "from Swiggy" | "to Amazon"
  const matches = text.matchAll(/\b(?:at|from|to)\s+((?:[A-Z][\w&.'-]+|Mc[a-z]+)(?:\s+(?:[A-Z][\w&.'-]+|de|le))?)/g);
  for (const m of matches) {
    const candidate = m[1].trim();
    if (candidate && !MERCHANT_STOPWORDS.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return "";
}

// ---------------------------------------------------------------------------

/**
 * Extract transaction fields from raw text (OCR output or speech transcript).
 *
 * @param source "voice" prefers spoken-number normalisation; "image" trusts
 *               receipt labels (total/amount) more.
 */
export function extractTransactionData(
  rawText: string,
  source: "voice" | "image" = "voice",
): ExtractedTransaction {
  const cleaned = rawText.replace(/\s+/g, " ").trim();
  const normalized = normalizeSpokenNumbers(cleaned);

  const amount = findAmount(normalized);
  const type = findType(normalized);
  const category = findCategory(normalized, type);
  const merchant = findMerchant(normalized);
  const paymentMethod = findPaymentMethod(normalized);
  const date = findDate(normalized);
  const time = findTime(normalized);

  // Confidence: how many fields were actually recovered, weighted by how
  // certain the amount match is (the field that matters most).
  let confidence = 0.15;
  if (amount) confidence += amount.weight >= 0.9 ? 0.4 : amount.weight >= 0.7 ? 0.3 : 0.15;
  if (category !== (type === "income" ? "Other" : "Misc")) confidence += 0.15;
  if (merchant) confidence += 0.1;
  if (paymentMethod) confidence += 0.05;
  if (date) confidence += 0.1;
  if (time) confidence += 0.05;
  if (source === "image" && cleaned.length > 40) confidence += 0.05;
  confidence = Math.min(0.95, confidence);

  const description = merchant
    ? `${type === "income" ? "Received from" : "Paid at"} ${merchant}`
    : cleaned.slice(0, 80);

  return {
    amount: amount ? amount.value : null,
    type,
    category,
    merchant,
    description,
    paymentMethod,
    date,
    time,
    confidence,
  };
}
