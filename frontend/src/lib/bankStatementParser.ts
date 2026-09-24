/**
 * Bank Statement PDF Parser
 * Parses PDF bank statements from major Indian banks and extracts transactions.
 *
 * How it works:
 *  1. extractTextFromPDF() renders each page's text items via pdf.js (worker is
 *     bundled locally, so no CDN dependency), then reconstructs visual lines by
 *     clustering items on their baseline Y coordinate — this preserves the row
 *     structure that transaction tables depend on, even for large statements.
 *  2. parseBankStatement() scans the reconstructed lines for transaction rows:
 *     date(s), narration, amounts (with Cr/Dr markers), and running balance.
 *     Credit vs debit is determined primarily by the balance delta between
 *     consecutive rows, which is robust across all column layouts
 *     (Withdrawal/Deposit, Debit/Credit, single amount + Dr/Cr suffix).
 */

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  merchant?: string;
  balance?: number;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  bankName: string;
  accountNumber?: string;
  statementPeriod?: { from: string; to: string };
  error?: string;
}

export interface ExtractionProgress {
  pagesDone: number;
  totalPages: number;
}

const MAX_PDF_BYTES = 100 * 1024 * 1024; // 100 MB hard cap

// ---------------------------------------------------------------------------
// Category mapping based on common transaction descriptions
// ---------------------------------------------------------------------------

const CATEGORY_MAPPINGS: Array<{ pattern: RegExp; category: string; type: 'income' | 'expense' }> = [
  // Income patterns
  { pattern: /salary|payroll|wage/i, category: 'Salary', type: 'income' },
  { pattern: /neft[\s\/-]*cr|nach[\s\/-]*cr|imps[\s\/-]*cr/i, category: 'Bank Transfer', type: 'income' },
  { pattern: /upi[\s\/-]*cr|\/cr\/|by cr/i, category: 'UPI Payment', type: 'income' },
  { pattern: /interest/i, category: 'Interest', type: 'income' },
  { pattern: /dividend/i, category: 'Investment', type: 'income' },
  { pattern: /refund|reversal/i, category: 'Refund', type: 'income' },
  { pattern: /cashback/i, category: 'Cashback', type: 'income' },
  { pattern: /cash deposit|cdm|by cash/i, category: 'Cash Deposit', type: 'income' },
  { pattern: /received from|credit from|trf from|from\b.*transfer/i, category: 'Bank Transfer', type: 'income' },

  // Expense patterns
  { pattern: /atm|cash wdl|withdrawal/i, category: 'ATM Withdrawal', type: 'expense' },
  { pattern: /\bpos\b|purchase/i, category: 'Shopping', type: 'expense' },
  { pattern: /neft[\s\/-]*dr|nach[\s\/-]*dr|imps[\s\/-]*dr/i, category: 'Bank Transfer', type: 'expense' },
  { pattern: /upi/i, category: 'UPI Payment', type: 'expense' },
  { pattern: /\bemi\b/i, category: 'EMI', type: 'expense' },
  { pattern: /loan/i, category: 'Loan', type: 'expense' },
  { pattern: /insurance|lic\b|policy/i, category: 'Insurance', type: 'expense' },
  { pattern: /electricity|bescom|adani energy|power/i, category: 'Utilities', type: 'expense' },
  { pattern: /mobile|airtel|jio|vi\b|bsnl|recharge/i, category: 'Mobile Recharge', type: 'expense' },
  { pattern: /swiggy/i, category: 'Food & Dining', type: 'expense' },
  { pattern: /zomato/i, category: 'Food & Dining', type: 'expense' },
  { pattern: /amazon/i, category: 'Shopping', type: 'expense' },
  { pattern: /flipkart|myntra|nykaa|ajio/i, category: 'Shopping', type: 'expense' },
  { pattern: /uber|ola|rapido|irctc|redbus|metro/i, category: 'Transportation', type: 'expense' },
  { pattern: /netflix|spotify|hotstar|prime video|youtube/i, category: 'Entertainment', type: 'expense' },
  { pattern: /\brent\b|landlord/i, category: 'Rent', type: 'expense' },
  { pattern: /grocery|bigbasket|blinkit|zepto|dmart|more retail/i, category: 'Groceries', type: 'expense' },
  { pattern: /medical|pharmacy|hospital|apollo|netmeds|1mg/i, category: 'Healthcare', type: 'expense' },
  { pattern: /petrol|fuel|hp\b|iocl|bpcl|shell|nayara/i, category: 'Fuel', type: 'expense' },
  { pattern: /school|college|fee\b|tuition/i, category: 'Education', type: 'expense' },
  { pattern: /hotel|restaurant|cafe|starbucks|mcd|kfc|domino/i, category: 'Food & Dining', type: 'expense' },
  { pattern: /gpay|googlepay|phonepe|paytm/i, category: 'UPI Payment', type: 'expense' },
];

const INCOME_KEYWORDS =
  /\b(cr|credit|credited|deposit|salary|interest|refund|cashback|reversal|received)\b|[\/\-]cr\b/i;

const MERCHANTS = [
  'swiggy', 'zomato', 'amazon', 'flipkart', 'uber', 'ola', 'rapido',
  'netflix', 'spotify', 'hotstar', 'bigbasket', 'blinkit', 'zepto',
  'paytm', 'phonepe', 'gpay', 'googlepay', 'myntra', 'nykaa',
  'cred', 'slice', 'simpl', 'lazypay', 'dmart', 'apollo', 'irctc',
  'airtel', 'jio', 'dominos', 'starbucks',
];

// ---------------------------------------------------------------------------
// Bank detection
// ---------------------------------------------------------------------------

export function detectBank(text: string): string {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('hdfc bank') || lowerText.includes('hdfcbank')) return 'HDFC';
  if (lowerText.includes('icici bank') || lowerText.includes('icicibank')) return 'ICICI';
  if (lowerText.includes('state bank of india') || /\bsbi\b/.test(lowerText)) return 'SBI';
  if (lowerText.includes('axis bank') || lowerText.includes('axisbank')) return 'AXIS';
  if (lowerText.includes('kotak mahindra') || lowerText.includes('kotak bank')) return 'KOTAK';
  if (lowerText.includes('punjab national bank') || /\bpnb\b/.test(lowerText)) return 'PNB';
  if (lowerText.includes('bank of baroda') || /\bbob\b/.test(lowerText)) return 'BOB';
  if (lowerText.includes('canara bank')) return 'CANARA';
  if (lowerText.includes('union bank')) return 'UNION';
  if (lowerText.includes('idbi bank')) return 'IDBI';
  if (lowerText.includes('yes bank')) return 'YES';
  if (lowerText.includes('indusind')) return 'INDUSIND';
  if (lowerText.includes('bandhan bank')) return 'BANDHAN';
  if (lowerText.includes('federal bank')) return 'FEDERAL';
  if (lowerText.includes('au small finance') || lowerText.includes('au bank')) return 'AU';

  return 'UNKNOWN';
}

// ---------------------------------------------------------------------------
// Date / amount primitives
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12',
};

// Ordered so unambiguous matches win; month names are validated via MONTH_MAP
const DATE_PATTERNS: Array<{ re: RegExp; kind: 'dmy4' | 'dmy2' | 'dmony4' | 'iso' | 'dmdot' | 'dmonyy2' }> = [
  { re: /\b(\d{1,2})[\/\-\s.](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[\/\-\s.](\d{4})\b/gi, kind: 'dmony4' }, // 15 Jan 2024 / 15-Jan-2024
  { re: /\b(\d{1,2})[\/\-\s.]'?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\/\-\s.']?(\d{2})\b/gi, kind: 'dmonyy2' }, // 15 Jan'24 / 15-Jan-24
  { re: /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g, kind: 'iso' }, // 2024-01-15
  { re: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g, kind: 'dmy4' }, // 15/01/2024
  { re: /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g, kind: 'dmdot' }, // 15.01.2024
  { re: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})\b/g, kind: 'dmy2' }, // 15/01/24
];

function normalizeDate(day: string, month: string, year: string): string | null {
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  let y = parseInt(year, 10);
  if (year.length === 2) y = 2000 + y;
  if (d < 1 || d > 31 || m < 1 || m > 12) return null;
  if (y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function normalizeDateWithMonth(day: string, mon: string, year: string): string | null {
  const m = MONTH_MAP[mon.toLowerCase().slice(0, 4)] || MONTH_MAP[mon.toLowerCase().slice(0, 3)];
  if (!m) return null;
  return normalizeDate(day, m, year);
}

export function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  for (const { re, kind } of DATE_PATTERNS) {
    const m = dateStr.match(re);
    if (!m) continue;
    switch (kind) {
      case 'dmony4':
      case 'dmonyy2':
        return normalizeDateWithMonth(m[1], m[2], m[3]);
      case 'iso':
        return normalizeDate(m[3], m[2], m[1]);
      default:
        return normalizeDate(m[1], m[2], m[3]);
    }
  }
  return null;
}

/** All date matches on a line (bank rows often carry txn date + value date). */
export function findDatesOnLine(line: string): Array<{ iso: string; start: number; end: number }> {
  const out: Array<{ iso: string; start: number; end: number }> = [];
  for (const { re, kind } of DATE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      let iso: string | null = null;
      if (kind === 'dmony4' || kind === 'dmonyy2') iso = normalizeDateWithMonth(m[1], m[2], m[3]);
      else if (kind === 'iso') iso = normalizeDate(m[3], m[2], m[1]);
      else iso = normalizeDate(m[1], m[2], m[3]);
      if (iso) out.push({ iso, start: m.index, end: m.index + m[0].length });
    }
  }
  // Deduplicate identical matches (same span, same result)
  const seen = new Set<string>();
  return out
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter((d) => {
      const key = `${d.start}:${d.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

interface AmountMatch {
  value: number;
  start: number;
  end: number;
  marker: 'cr' | 'dr' | null;
}

/**
 * Find monetary amounts on a line. Handles Indian grouping (1,23,456.00),
 * plain numbers, optional currency prefixes and trailing Cr/Dr markers.
 * Requires decimals OR a thousands comma OR a currency prefix so that bare
 * reference numbers ("123456") are not mistaken for amounts.
 */
export function findAmountsOnLine(line: string): AmountMatch[] {
  const re = new RegExp(
    /((?:₹|rs\.?|inr)\s*)?(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|(?:₹|rs\.?|inr)\s*\d+)(\s*(?:cr|dr)\.?)?(?![a-z0-9])/gi
  );
  const out: AmountMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const raw = m[2].replace(/,/g, '');
    const value = parseFloat(raw);
    if (isNaN(value)) continue;
    const marker = m[3] ? (m[3].toLowerCase().includes('c') ? 'cr' : 'dr') : null;
    out.push({ value, start: m.index, end: m.index + m[0].length, marker });
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Categorization
// ---------------------------------------------------------------------------

function categorizeTransaction(description: string): { category: string; type: 'income' | 'expense' } {
  for (const { pattern, category, type } of CATEGORY_MAPPINGS) {
    if (pattern.test(description)) return { category, type };
  }
  if (INCOME_KEYWORDS.test(description)) return { category: 'Other Income', type: 'income' };
  return { category: 'Other Expense', type: 'expense' };
}

function extractMerchant(description: string): string | undefined {
  const lowerDesc = description.toLowerCase();
  for (const merchant of MERCHANTS) {
    if (lowerDesc.includes(merchant)) {
      return merchant.charAt(0).toUpperCase() + merchant.slice(1);
    }
  }
  const upiMatch = description.match(/@([a-zA-Z]{3,})/);
  if (upiMatch) return upiMatch[1].toUpperCase();
  return undefined;
}

// ---------------------------------------------------------------------------
// PDF text extraction (browser)
// ---------------------------------------------------------------------------

/**
 * Pure helper: turn pdf.js text items into visual lines by clustering on the
 * baseline Y coordinate. Exported for testing.
 */
export function textItemsToLines(items: Array<{ str: string; transform?: number[]; hasEOL?: boolean }>): string {
  type Item = { str: string; x: number; y: number };
  const parsed: Item[] = [];
  for (const item of items) {
    if (!item.str) continue;
    const t = item.transform;
    parsed.push({ str: item.str, x: t ? t[4] : 0, y: t ? t[5] : 0 });
    if (item.hasEOL) parsed.push({ str: '\n', x: t ? t[4] : 0, y: t ? t[5] : 0 });
  }
  if (parsed.length === 0) return '';

  // Cluster Y values: items within tolerance share a line
  const Y_TOLERANCE = 2.5;
  const sorted = [...parsed].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: Item[][] = [];
  let current: Item[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const it = sorted[i];
    if (it.str === '\n') {
      lines.push(current);
      current = [];
      currentY = NaN;
      continue;
    }
    if (Number.isFinite(currentY) && Math.abs(it.y - currentY) <= Y_TOLERANCE) {
      current.push(it);
      continue;
    }
    if (current.length) lines.push(current);
    current = [it];
    currentY = it.y;
  }
  if (current.length) lines.push(current);

  return lines
    .map((lineItems) =>
      lineItems
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((l) => l.length > 0)
    .join('\n');
}

/**
 * Extract text from a PDF file in the browser. The pdf.js worker is bundled
 * with the app (no CDN fetch), pages are processed sequentially with progress
 * callbacks so large statements don't freeze the UI.
 */
export async function extractTextFromPDF(
  file: File,
  onProgress?: (p: ExtractionProgress) => void
): Promise<string> {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error(
      `File is too large (${(file.size / (1024 * 1024)).toFixed(0)} MB). Please upload a statement under 100 MB.`
    );
  }

  const pdfjsLib = await import('pdfjs-dist');
  // Worker is bundled locally and version-matched automatically (?url import).
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.({ pagesDone: i - 1, totalPages: pdf.numPages });
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    pageTexts.push(textItemsToLines(textContent.items as any));
    page.cleanup();
    // Yield to the event loop so the spinner/progress paints between pages
    if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  onProgress?.({ pagesDone: pdf.numPages, totalPages: pdf.numPages });

  await pdf.destroy();

  const fullText = pageTexts.join('\n');
  // Scanned/image-only PDFs produce almost no text
  if (fullText.replace(/\s/g, '').length < 20 * pdf.numPages) {
    throw new Error(
      'This PDF appears to be a scanned statement (no extractable text). Please upload the digital/original PDF from your bank, not a photocopy or scan.'
    );
  }
  return fullText;
}

// ---------------------------------------------------------------------------
// Statement parsing
// ---------------------------------------------------------------------------

// Narrow list for candidate transaction rows: these rows carry a balance but
// are not transactions (e.g. "Brought Forward 01/04/2024  10,000.00").
const ROW_SKIP_RE =
  /(opening\s*balance|closing\s*balance|b\/?f\b|brought\s*forward|carried\s*forward|c\/?f\b)/i;

// Broad list used only when deciding whether a date-less, amount-less line is
// a wrapped narration (keep) or page furniture (drop).
const FURNITURE_RE =
  /(page\s*\d+(\s*(of|\/)\s*\d+)?|statement\s+(of|summary|period)|account\s*(no|number|statement)|total\b|grand\s+total|sub\s*total|summary|ifsc|micr|registered\s+office|this\s+is\s+a\s+(system|computer)\s+generated|end\s+of\s+(statement|report))/i;

interface RawRow {
  date: string;
  description: string;
  amounts: AmountMatch[];
}

function parseGenericStatement(text: string): ParsedTransaction[] {
  const lines = text.split('\n');
  const transactions: ParsedTransaction[] = [];

  let prevBalance: number | null = null;

  const pushRow = (row: RawRow) => {
    const amounts = row.amounts;
    let amount: number | null = null;
    let type: 'income' | 'expense' | null = null;
    let balance: number | undefined;

    // Last amount on the row is conventionally the running balance
    let candidates: AmountMatch[];
    if (amounts.length >= 2) {
      balance = round2(amounts[amounts.length - 1].value);
      candidates = amounts.slice(0, -1);
    } else {
      candidates = amounts.slice();
    }

    // 1) Balance-delta: the most reliable credit/debit signal
    if (prevBalance !== null && balance !== undefined) {
      const delta = round2(balance - prevBalance);
      if (delta !== 0) {
        type = delta > 0 ? 'income' : 'expense';
        amount = Math.abs(delta);
        // Prefer an explicit candidate that matches the delta (multi-amount rows)
        const matching = candidates.find((c) => Math.abs(c.value - amount!) < 0.005);
        if (matching) amount = matching.value;
      }
    }

    // 2) Explicit Cr/Dr markers on the candidate amounts
    if (type === null) {
      const crCandidate = candidates.find((c) => c.marker === 'cr');
      const drCandidate = candidates.find((c) => c.marker === 'dr');
      if (crCandidate) {
        type = 'income';
        amount = crCandidate.value;
      } else if (drCandidate) {
        type = 'expense';
        amount = drCandidate.value;
      }
    }

    // 3) Single candidate + keyword fallback
    if (type === null) {
      if (candidates.length === 1) amount = candidates[0].value;
      else if (candidates.length > 1) amount = candidates[candidates.length - 1].value;
      if (amount !== null && amount !== 0) {
        type = INCOME_KEYWORDS.test(row.description) ? 'income' : 'expense';
      }
    }

    if (amount === null || amount === 0 || type === null) {
      if (balance !== undefined) prevBalance = balance;
      return;
    }

    // Clean up description: strip trailing value-date, ref numbers, separators
    let description = row.description
      .replace(/\s+/g, ' ')
      .replace(/[\s\-\/#*.,]+$/g, '')
      .trim();
    if (!description) description = 'Transaction';

    const categorization = categorizeTransaction(description);
    // If balance-delta or a marker says income, trust it over the category guess
    const finalCategory =
      type === 'income' && categorization.type === 'expense' && categorization.category !== 'Salary'
        ? 'Other Income'
        : categorization.category;

    transactions.push({
      date: row.date,
      description,
      amount: round2(amount),
      type,
      category: finalCategory,
      merchant: extractMerchant(description) || undefined,
      balance,
    });

    if (balance !== undefined) prevBalance = balance;
  };

  let lastWasTransaction = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      lastWasTransaction = false;
      continue;
    }

    const dates = findDatesOnLine(line);
    const amounts = findAmountsOnLine(line);

    // Continuation line: wrapped narration from the previous row
    if (dates.length === 0 && amounts.length === 0) {
      if (lastWasTransaction && line.length > 3 && !FURNITURE_RE.test(line)) {
        const prev = transactions[transactions.length - 1];
        if (prev && prev.description.length < 200) {
          prev.description = `${prev.description} ${line}`.replace(/\s+/g, ' ').trim();
        }
      }
      continue;
    }

    // Needs both a date and an amount to be a transaction row
    if (dates.length === 0 || amounts.length === 0) {
      lastWasTransaction = false;
      continue;
    }

    if (ROW_SKIP_RE.test(line)) {
      // Some rows like "Opening Balance" carry the starting balance
      const bal = amounts[amounts.length - 1];
      if (/opening\s*balance|b\/?f\b|brought\s*forward/i.test(line) && bal) {
        prevBalance = round2(bal.value);
      }
      lastWasTransaction = false;
      continue;
    }

    const firstDate = dates[0];
    const firstAmount = amounts[0];
    const descStart = firstDate.end;
    const descEnd = firstAmount.start;
    let description = line.substring(descStart, descEnd).trim();
    // Strip a trailing second (value) date if present
    if (dates.length > 1) {
      for (const d of dates.slice(1)) {
        const relStart = d.start - descStart;
        const relEnd = d.end - descStart;
        if (relStart >= 0 && relEnd <= description.length) {
          description = (
            description.slice(0, relStart) + ' ' + description.slice(relEnd)
          ).replace(/\s+/g, ' ').trim();
        }
      }
    }
    description = description.replace(/\s+/g, ' ').trim();

    pushRow({
      date: firstDate.iso,
      description,
      amounts,
    });
    lastWasTransaction = true;
  }

  return transactions;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function parseBankStatement(pdfText: string): Promise<ParseResult> {
  try {
    const bankName = detectBank(pdfText);
    const transactions = parseGenericStatement(pdfText);

    const accountMatch = pdfText.match(/(?:account|a\/c)\s*(?:no|number)?\.?\s*[:#]?\s*([xX*\d]{6,20}\d)/i);
    const accountNumber = accountMatch ? accountMatch[1] : undefined;

    const periodMatch = pdfText.match(
      /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}[\s\-.]?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-.]?\d{2,4})\s*(?:to|[-–—])\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}[\s\-.]?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-.]?\d{2,4})/i
    );
    const statementPeriod = periodMatch
      ? {
          from: parseDate(periodMatch[1]) || periodMatch[1],
          to: parseDate(periodMatch[2]) || periodMatch[2],
        }
      : undefined;

    return {
      transactions,
      bankName,
      accountNumber,
      statementPeriod,
    };
  } catch (error) {
    return {
      transactions: [],
      bankName: 'UNKNOWN',
      error: error instanceof Error ? error.message : 'Failed to parse PDF',
    };
  }
}
