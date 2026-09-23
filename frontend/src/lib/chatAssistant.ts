/**
 * Offline fallback for the chat widget. When the AI server (port 8001) is
 * unreachable, this answers from the user's REAL app data — transactions,
 * budgets, goals, saved analysis — plus built-in gig-finance knowledge.
 * It never calls an LLM, so it always works.
 */

import db from "@/services/database";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

interface Sums {
  today: { income: number; expense: number };
  week: { income: number; expense: number };
  month: { income: number; expense: number };
  categories: Array<{ name: string; amount: number }>;
  count: number;
}

async function getSums() {
  const txs = await db.transactions.getAll();
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
  const monthStart = `${todayStr.slice(0, 7)}-01`;

  const sums = {
    today: { income: 0, expense: 0 },
    week: { income: 0, expense: 0 },
    month: { income: 0, expense: 0 },
    categories: new Map<string, number>(),
    count: txs.length,
  };

  for (const t of txs) {
    const d = t.transaction_date || "";
    const amount = Number(t.amount) || 0;
    if (d === todayStr) {
      if (t.transaction_type === "income") sums.today.income += amount;
      else sums.today.expense += amount;
    }
    if (d >= weekAgo) {
      if (t.transaction_type === "income") sums.week.income += amount;
      else sums.week.expense += amount;
    }
    if (d >= monthStart) {
      if (t.transaction_type === "income") sums.month.income += amount;
      else {
        sums.month.expense += amount;
        const cat = t.category || "Other";
        sums.categories.set(cat, (sums.categories.get(cat) || 0) + amount);
      }
    }
  }

  return {
    sums,
    topCategories: [...sums.categories.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
    txCount: txs.length,
  };
}

function estimateTax(annualIncome: number) {
  // Sec 44AD presumptive (6% of digital-heavy gross) + new regime + 87A + cess
  const taxable = annualIncome * 0.06;
  let tax = 0;
  if (taxable > 400000 && taxable <= 800000) tax = (taxable - 400000) * 0.05;
  else if (taxable > 800000 && taxable <= 1200000) tax = 20000 + (taxable - 800000) * 0.1;
  else if (taxable > 1200000 && taxable <= 1600000) tax = 60000 + (taxable - 1200000) * 0.15;
  else if (taxable > 1600000) tax = 120000 + (taxable - 1600000) * 0.2;
  const afterRebate = taxable <= 1200000 ? Math.max(0, tax - 60000) : tax;
  const total = afterRebate * 1.04;
  return { taxable, total, isFree: total === 0 };
}

/**
 * Compact real-data summary sent along with chat requests so the AI server
 * can answer "how much did I spend" style questions with actual numbers.
 */
export async function buildFinancialSnapshot(): Promise<string> {
  try {
    const { sums, topCategories, txCount } = await getSums();
    const lines = [
      `Today: income ${inr(sums.today.income)}, expense ${inr(sums.today.expense)}`,
      `Last 7 days: income ${inr(sums.week.income)}, expense ${inr(sums.week.expense)}`,
      `This month: income ${inr(sums.month.income)}, expense ${inr(sums.month.expense)}`,
    ];
    if (topCategories.length > 0) {
      lines.push(
        `Top expense categories this month: ${topCategories.slice(0, 3).map(c => `${c.name} ${inr(c.amount)}`).join(", ")}`,
      );
    }
    try {
      const accounts = await db.bankAccounts.getAll();
      const balance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
      lines.push(`Recorded bank balance: ${inr(balance)}`);
    } catch { /* optional */ }
    try {
      const goals = await db.savingsGoals.getAll();
      if (goals.length > 0) {
        lines.push(
          `Goals: ${goals.slice(0, 3).map(g => {
            const pct = Number(g.target_amount) > 0
              ? Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100))
              : 0;
            return `${g.goal_name} ${pct}%`;
          }).join(", ")}`,
        );
      }
    } catch { /* optional */ }
    try {
      const health = await db.financialHealth.getLatest();
      if (health?.health_score != null) {
        lines.push(
          `Latest AI analysis: health score ${health.health_score}/100, volatility ${Math.round(Number(health.volatility_index) * 100)}%, emergency fund ${health.emergency_fund_months} months`,
        );
      }
    } catch { /* optional */ }
    lines.push(`Transactions recorded: ${txCount}`);
    return lines.join("\n");
  } catch {
    return "No transaction data available yet.";
  }
}

export async function answerLocally(query: string): Promise<string> {
  const q = query.toLowerCase();
  const { sums, topCategories, txCount } = await getSums();

  // ---- Balance ----
  if (/balance|bank|how much money (do i|have)/.test(q)) {
    const accounts = await db.bankAccounts.getAll();
    const total = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
    const lines = accounts.map(a => `• ${a.account_name}: ${inr(Number(a.current_balance || 0))}`);
    return `Your recorded balance is ${inr(total)} across ${accounts.length} account(s):\n${lines.join("\n")}\n\nYou can update accounts on the Profile page.`;
  }

  // ---- Spending ----
  if (/(spend|spent|expense|paid)/.test(q)) {
    if (/today/.test(q)) {
      return `Today you've spent ${inr(sums.today.expense)} across your transactions (and earned ${inr(sums.today.income)}). See the breakdown on the Transactions page.`;
    }
    if (/(week|7 day)/.test(q)) {
      return `In the last 7 days you've spent ${inr(sums.week.expense)} and earned ${inr(sums.week.income)} — net ${inr(sums.week.income - sums.week.expense)}.`;
    }
    const top = topCategories[0]
      ? ` Your biggest category this month is ${topCategories[0].name} at ${inr(topCategories[0].amount)}.`
      : "";
    return `This month you've spent ${inr(sums.month.expense)} so far.${top} The Stats page has the full category breakdown.`;
  }

  // ---- Earnings ----
  if (/(earn|income|made|received|revenue)/.test(q)) {
    if (/today/.test(q)) {
      return `Today you've earned ${inr(sums.today.income)}${sums.today.expense > 0 ? ` and spent ${inr(sums.today.expense)}` : ""}.`;
    }
    if (/(week|7 day)/.test(q)) {
      return `In the last 7 days you've earned ${inr(sums.week.income)} and spent ${inr(sums.week.expense)} — net ${inr(sums.week.income - sums.week.expense)}.`;
    }
    return `This month you've earned ${inr(sums.month.income)} and spent ${inr(sums.month.expense)} — net ${inr(sums.month.income - sums.month.expense)}.`;
  }

  // ---- Tax ----
  if (/tax|87a|44ad|regime|itr|deduct/.test(q)) {
    const avgWeekly = sums.week.income || 0;
    const annual = avgWeekly * 52;
    const est = estimateTax(annual);
    const personal = txCount > 0 && avgWeekly > 0
      ? `\n\nBased on your recent earnings (~${inr(annual)}/year projected), your taxable income under Sec 44AD presumptive taxation (6%) is ${inr(est.taxable)}, and your estimated annual tax is ${est.isFree ? "₹0 — fully covered by the 87A rebate 🎉" : `${inr(est.total)} (about ${inr(est.total / 12)}/month). File ITR-4.`}`
      : "";
    return `Quick facts (FY 2024-25 New Regime):\n• Sec 87A rebate: zero tax if taxable income ≤ ₹12 lakh (rebate up to ₹60,000).\n• Gig workers can use Sec 44AD/44ADA presumptive taxation — only 6% of gross receipts counts as taxable income when most payments are digital.\n• Slabs: 0–4L nil, 4–8L 5%, 8–12L 10%, then 15/20/25/30%.${personal}\n\nThe Tax page has a full calculator.`;
  }

  // ---- Budget ----
  if (/budget/.test(q)) {
    const active = await db.budgets.getActive();
    if (active) {
      return `Your current ${active.budget_type} budget: expected income ${inr(Number(active.total_income_expected))}, savings target ${inr(Number(active.savings_target))}, discretionary spend ${inr(Number(active.discretionary_budget))}.\n\nTip: with irregular income, set your weekly budget from your famine-week (low) estimate — treat feast weeks as saving opportunities. Run the AI Financial Analysis on Home to refresh these numbers.`;
    }
    return "You don't have a budget yet. Tap Start Analysis on the Home page — the Budget agent creates Feast/Famine/Monthly budgets from your real transactions.";
  }

  // ---- Goals ----
  if (/goal|saving.*target|target/.test(q)) {
    const goals = await db.savingsGoals.getAll();
    if (goals.length === 0) {
      return "You haven't created any savings goals yet. Head to the Goals page to add one — even a small weekly target builds the habit.";
    }
    const lines = goals.slice(0, 4).map(g => {
      const pct = Number(g.target_amount) > 0
        ? Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100))
        : 0;
      return `• ${g.goal_name}: ${pct}% funded (${inr(Number(g.current_amount))} of ${inr(Number(g.target_amount))})`;
    });
    return `Your goals:\n${lines.join("\n")}\n\nAdd contributions from the Goals page to keep them moving.`;
  }

  // ---- Risk / volatility / analysis ----
  if (/volatil|risk|health|score|analys|insight/.test(q)) {
    const health = await db.financialHealth.getLatest();
    const v = Number(health?.volatility_index ?? 0);
    const trend = v < 0.2 ? "stable" : v < 0.5 ? "moderately variable" : "highly variable";
    return `Your latest financial health score is ${health?.health_score ?? "—"}/100, with income volatility at ${Math.round(v * 100)}% (${trend}) and about ${health?.emergency_fund_months ?? "?"} months of expenses in emergency cover.\n\nGig income swings week to week — the fix is a buffer: in high-earning weeks, park the surplus; draw it down in slow weeks. Tap Start Analysis on Home for fresh numbers.`;
  }

  // ---- App how-to ----
  if (/(scan|receipt|photo|image|bill)/.test(q)) {
    return "To scan a receipt: on the Home page, open the **Image** tab in the Add Transaction card and upload or snap a photo of the bill. The text is read right in your browser and the amount, merchant, date and category are auto-filled into the form for you to review.";
  }
  if (/(voice|speak|microphone|mic|talk)/.test(q)) {
    return "To add a transaction by voice: open the **Voice** tab on the Home page, tap Start Listening, and say something like \"I spent 250 rupees on petrol\". The first use downloads a small offline speech model (~40 MB, once), then it works even without internet.";
  }
  if (/(add|create|enter|log|record).*(transaction|expense|income)|how.*add/.test(q)) {
    return "Adding a transaction: Home page → Add Transaction card → three ways:\n1. **Manual** — type amount, category, date.\n2. **Image** — upload a receipt photo, details are extracted automatically.\n3. **Voice** — speak your transaction naturally.";
  }

  // ---- Greeting / help ----
  if (/^(hi|hello|hey|namaste|help|what can you)/.test(q.trim())) {
    return `Hi! I can help with:\n• Your money — "How much did I spend this month?", "What's my balance?"\n• Taxes — 87A rebate, 44AD presumptive taxation, ITR filing\n• Budgeting & emergency funds for irregular income\n• Using the app — receipts, voice entries, AI analysis\n\nWhat would you like to know?`;
  }

  // ---- Default ----
  return `I'm your ArthaSetu assistant. I can answer from your actual data — try "How much did I spend this month?", "Estimate my tax", "How are my goals doing?" — or ask about budgeting, taxes and emergency funds as a gig worker.\n\n(Tip: for full AI-powered answers, start the AI server: python -m uvicorn simple_api_server:app --port 8001)`;
}
