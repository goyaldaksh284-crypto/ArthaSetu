/**
 * Client-side AI Financial Analysis — a faithful port of the deterministic
 * cores of the 9 backend agents (backend/agents/finance_helpers.py), running
 * in the browser on the user's real transaction data. No server, no LLM keys:
 * the backend only used an LLM for narrative text, all numbers are computed
 * with the same formulas here.
 *
 * Agents (same order/orchestration as backend/main.py):
 *   1. volatility_agent      - income stats & volatility forecast
 *   2. budget_agent          - feast/famine/monthly budgets
 *   3. tax_agent             - Section 44AD presumptive + new regime + 87A
 *   4. risk_agent            - composite risk score
 *   5. savings_investment    - daily micro-savings plan
 *   6. bill_payment          - recurring bill detection
 *   7. goals_agent           - savings goal progress
 *   8. recommendation_agent  - prioritised recommendations
 *   9. action_agent          - concrete pending actions
 */

import db from "@/services/database";
import type { Transaction } from "@/services/database";

export interface AgentProgress {
  completed: number;
  total: number;
  currentAgent: string;
}

export interface AnalysisSummary {
  healthScore: number;
  volatilityIndex: number;
  emergencyFundMonths: number;
  monthlyTaxDue: number;
  dailySavings: number;
  recommendationsCount: number;
  actionsCount: number;
}

// ============================================================================
// Stats (port of compute_income_expense_stats)
// ============================================================================

interface IncomeStats {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  avgWeeklyIncome: number;
  avgDailyIncome: number;
  avgDailyExpense: number;
  incomeVolatility: number;
  weekdayIncome: Record<string, number>;
  categoryExpenses: Record<string, number>;
  transactionCount: number;
  incomeTransactionCount: number;
  daysSpan: number;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function pstdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function computeStats(transactions: Transaction[]): IncomeStats {
  const income = transactions.filter(t => t.transaction_type === "income").map(t => Number(t.amount));
  const expenses = transactions.filter(t => t.transaction_type === "expense").map(t => Number(t.amount));

  const totalIncome = income.reduce((a, b) => a + b, 0);
  const totalExpenses = expenses.reduce((a, b) => a + b, 0);

  const weekdayIncome: Record<string, number> = {};
  for (const d of WEEKDAYS) weekdayIncome[d] = 0;
  const categoryExpenses: Record<string, number> = {};

  const dates: string[] = [];
  for (const t of transactions) {
    if (t.transaction_date) dates.push(t.transaction_date);
    if (t.transaction_type === "income" && t.transaction_date) {
      const day = WEEKDAYS[new Date(`${t.transaction_date}T00:00:00`).getDay()];
      weekdayIncome[day] += Number(t.amount);
    }
    if (t.transaction_type === "expense") {
      const cat = t.category || "Other";
      categoryExpenses[cat] = (categoryExpenses[cat] || 0) + Number(t.amount);
    }
  }

  let daysSpan = 30;
  if (dates.length > 0) {
    const sorted = [...dates].sort();
    daysSpan = Math.max(
      (new Date(`${sorted[sorted.length - 1]}T00:00:00`).getTime() - new Date(`${sorted[0]}T00:00:00`).getTime()) / 86400000,
      1,
    );
  }
  const weeksSpan = Math.max(daysSpan / 7, 1);
  const avgWeeklyIncome = totalIncome / weeksSpan;
  const incomeVolatility =
    income.length > 1 && avgWeeklyIncome > 0 ? Math.min(pstdev(income) / avgWeeklyIncome, 1) : 0;

  return {
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
    avgWeeklyIncome,
    avgDailyIncome: totalIncome / Math.max(daysSpan, 1),
    avgDailyExpense: totalExpenses / Math.max(daysSpan, 1),
    incomeVolatility,
    weekdayIncome,
    categoryExpenses,
    transactionCount: transactions.length,
    incomeTransactionCount: income.length,
    daysSpan,
  };
}

// ============================================================================
// Port of compute_risk_assessment + health score
// ============================================================================

function computeRisk(stats: IncomeStats, emergencyFund: number) {
  const monthlyIncome = stats.avgWeeklyIncome * 4.33;
  const monthlyExpenses = stats.avgDailyExpense * 30;
  const debtToIncome = 0; // no debt data captured client-side yet
  const emergencyFundCoverage = monthlyExpenses > 0 ? emergencyFund / monthlyExpenses : 0;
  const volatility = stats.incomeVolatility;

  const dtiRisk = Math.min(debtToIncome / 0.5, 1) * 4;
  const fundRisk = Math.max(0, 1 - emergencyFundCoverage / 6) * 3;
  const volatilityRisk = Math.min(volatility, 1) * 3;
  const riskScore = Math.round((dtiRisk + fundRisk + volatilityRisk) * 10) / 10;

  const riskLevel = riskScore <= 3 ? "low" : riskScore <= 6 ? "medium" : "high";

  const riskFactors = [
    { factor: "Debt-to-income ratio", impact: `${(debtToIncome * 100).toFixed(1)}% of monthly income` },
    { factor: "Emergency fund", impact: `${emergencyFundCoverage.toFixed(1)} months of expenses covered` },
    { factor: "Income volatility", impact: `${(volatility * 100).toFixed(1)}% variation week to week` },
  ];

  const recommendedActions: Array<{ action: string; description: string }> = [];
  if (emergencyFundCoverage < 6) {
    recommendedActions.push({
      action: "Build emergency fund",
      description: "Target at least 6 months of expenses in liquid savings",
    });
  }
  if (volatility > 0.4) {
    recommendedActions.push({
      action: "Smooth income volatility",
      description: "Set aside a larger buffer during high-income weeks to cover low-income weeks",
    });
  }

  // Health score: inverse of risk, weighted with savings behaviour
  const savingsRate = monthlyIncome > 0 ? Math.max(0, (monthlyIncome - monthlyExpenses) / monthlyIncome) : 0;
  const healthScore = Math.round(
    Math.max(5, Math.min(100, 100 - riskScore * 8 + Math.min(savingsRate, 0.5) * 40)),
  );

  return {
    overallRiskLevel: riskLevel,
    riskScore,
    riskFactors,
    debtToIncomeRatio: debtToIncome,
    emergencyFundCoverage,
    monthlyIncome,
    monthlyExpenses,
    savingsRate,
    recommendedActions,
    healthScore,
  };
}

// ============================================================================
// Port of compute_budgets (feast/famine/monthly)
// ============================================================================

function computeBudgets(stats: IncomeStats) {
  const weekdayValues = Object.values(stats.weekdayIncome).filter(v => v > 0);
  const stdev = weekdayValues.length > 1 ? pstdev(weekdayValues) : stats.avgWeeklyIncome * 0.3;

  const feastIncome = Math.round(stats.avgWeeklyIncome + stdev);
  const famineIncome = Math.round(Math.max(stats.avgWeeklyIncome - stdev, 0));
  const monthlyIncome = Math.round(stats.avgWeeklyIncome * 4.33);

  const weeksSpan = Math.max(stats.daysSpan / 7, 1);
  const variableCosts: Record<string, number> = {};
  for (const [k, v] of Object.entries(stats.categoryExpenses)) {
    variableCosts[k] = Math.round(v / weeksSpan);
  }
  const totalVariable = Object.values(variableCosts).reduce((a, b) => a + b, 0);
  const totalFixed = 0;

  const makeBudget = (budgetType: string, income: number, savingsRate: number, validDays: number) => {
    const savingsTarget = Math.round(Math.max(income - totalFixed - totalVariable, 0) * savingsRate);
    const discretionary = Math.round(Math.max(income - totalFixed - totalVariable - savingsTarget, 0));
    const validFrom = new Date();
    const validUntil = new Date(Date.now() + validDays * 86400000);
    return {
      budget_type: budgetType as "feast" | "famine" | "normal" | "monthly" | "weekly",
      valid_from: validFrom.toISOString().split("T")[0],
      valid_until: validUntil.toISOString().split("T")[0],
      total_income_expected: income,
      fixed_costs: {} as Record<string, number>,
      variable_costs: variableCosts,
      savings_target: savingsTarget,
      discretionary_budget: discretionary,
      category_limits: Object.fromEntries(
        Object.entries(variableCosts).map(([k, v]) => [k, Math.round(v * 1.15)]),
      ),
      confidence_score: stats.incomeTransactionCount >= 8 ? 0.8 : 0.5,
      is_active: true,
    };
  };

  return [
    makeBudget("feast", feastIncome, 0.35, 7),
    makeBudget("famine", famineIncome, 0, 7),
    makeBudget("monthly", monthlyIncome, 0.2, 30),
  ];
}

// ============================================================================
// Port of compute_gig_worker_tax (44AD presumptive + new regime + 87A + cess)
// ============================================================================

function calculateTaxNewRegime(taxableIncome: number): number {
  if (taxableIncome <= 400000) return 0;
  if (taxableIncome <= 800000) return (taxableIncome - 400000) * 0.05;
  if (taxableIncome <= 1200000) return 20000 + (taxableIncome - 800000) * 0.1;
  if (taxableIncome <= 1600000) return 60000 + (taxableIncome - 1200000) * 0.15;
  if (taxableIncome <= 2000000) return 120000 + (taxableIncome - 1600000) * 0.2;
  if (taxableIncome <= 2400000) return 200000 + (taxableIncome - 2000000) * 0.25;
  return 300000 + (taxableIncome - 2400000) * 0.3;
}

function computeGigWorkerTax(annualGrossIncome: number) {
  const taxableIncome = annualGrossIncome * 0.06; // Sec 44AD presumptive, >=95% digital
  const grossTax = calculateTaxNewRegime(taxableIncome);
  const afterRebate = taxableIncome <= 1200000 ? Math.max(0, grossTax - 60000) : grossTax;
  const totalTax = afterRebate * 1.04; // 4% health & education cess
  return {
    annualGrossIncome: Math.round(annualGrossIncome),
    taxableIncome: Math.round(taxableIncome),
    rebate87A: Math.round(grossTax - afterRebate),
    totalTaxLiability: Math.round(totalTax),
    itrFormType: "ITR-4",
    isTaxFree: totalTax === 0,
  };
}

// ============================================================================
// Bill detection: merchants/categories recurring across >= 2 distinct months
// ============================================================================

function detectRecurringBills(transactions: Transaction[]) {
  const byKey = new Map<string, Set<string>>();
  for (const t of transactions) {
    if (t.transaction_type !== "expense") continue;
    const key = (t.merchant_name || t.category || "Other").trim();
    const month = (t.transaction_date || "").slice(0, 7);
    if (!month) continue;
    if (!byKey.has(key)) byKey.set(key, new Set());
    byKey.get(key)!.add(month);
  }
  const bills: Array<{ name: string; monthlyAmount: number; months: number }> = [];
  for (const [name, months] of byKey) {
    if (months.size >= 2) {
      const amounts = transactions
        .filter(t => t.transaction_type === "expense" && (t.merchant_name || t.category || "Other").trim() === name)
        .map(t => Number(t.amount));
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      bills.push({ name, monthlyAmount: Math.round(avg), months: months.size });
    }
  }
  return bills.sort((a, b) => b.monthlyAmount - a.monthlyAmount).slice(0, 5);
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

// ============================================================================
// Orchestration (mirrors backend/main.py run_analysis order)
// ============================================================================

export async function runFullAnalysis(
  onProgress?: (progress: AgentProgress) => void,
): Promise<AnalysisSummary> {
  const totalAgents = 9;
  let completed = 0;
  const step = async (name: string, fn: () => Promise<void> | void) => {
    onProgress?.({ completed, total: totalAgents, currentAgent: name });
    await fn();
    // Small pause so the progress UI is perceivable
    await new Promise(r => setTimeout(r, 250));
    completed += 1;
    onProgress?.({ completed, total: totalAgents, currentAgent: name });
  };

  // ---- Gather real data ----
  const transactions = await db.transactions.getAll();
  if (transactions.length === 0) {
    throw new Error("No transactions to analyze. Add a few income and expense entries first.");
  }
  const accounts = await db.bankAccounts.getAll();
  const emergencyFund = accounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);
  const goals = await db.savingsGoals.getAll();

  // ---- 1. Volatility agent ----
  let stats!: IncomeStats;
  let volatilityForecast!: { trend: string; optimistic: number; pessimistic: number };
  await step("Volatility Forecaster", () => {
    stats = computeStats(transactions);
    const weekdayValues = Object.values(stats.weekdayIncome).filter(v => v > 0);
    const stdev = weekdayValues.length > 1 ? pstdev(weekdayValues) : stats.avgWeeklyIncome * 0.3;
    volatilityForecast = {
      trend: stats.incomeVolatility < 0.2 ? "stable" : stats.incomeVolatility < 0.5 ? "moderate" : "volatile",
      optimistic: Math.round(stats.avgWeeklyIncome + stdev),
      pessimistic: Math.round(Math.max(stats.avgWeeklyIncome - stdev, 0)),
    };
  });

  // ---- 2. Budget agent ----
  let budgets!: Awaited<ReturnType<typeof computeBudgets>>;
  await step("Budget Analysis", () => {
    budgets = computeBudgets(stats);
  });
  for (const b of budgets) await db.budgets.create(b);

  // ---- 3. Tax agent ----
  let tax!: ReturnType<typeof computeGigWorkerTax>;
  await step("Tax Compliance", () => {
    const annualIncome = stats.avgWeeklyIncome * 52;
    tax = computeGigWorkerTax(annualIncome);
  });

  // ---- 4. Risk agent ----
  let risk!: ReturnType<typeof computeRisk>;
  await step("Risk Assessment", () => {
    risk = computeRisk(stats, emergencyFund);
  });
  await db.financialHealth.saveLatest({
    health_score: risk.healthScore,
    emergency_fund_months: Math.round(risk.emergencyFundCoverage * 10) / 10,
    dti_ratio: risk.debtToIncomeRatio,
    volatility_index: stats.incomeVolatility,
    savings_rate: Math.round(risk.savingsRate * 100) / 100,
  });
  await db.riskAssessments.saveLatest({
    // Shape matches RiskDashboard.tsx / backend compute_risk_assessment output
    overall_risk_level: risk.overallRiskLevel,
    risk_score: risk.riskScore,
    debt_to_income_ratio: risk.debtToIncomeRatio,
    income_drop_percentage: 0,
    expense_spike_factor: 1.0,
    emergency_fund_coverage: Math.round(risk.emergencyFundCoverage * 10) / 10,
    volatility_score: Math.round(stats.incomeVolatility * 10),
    risk_factors: risk.riskFactors,
    recommended_actions: risk.recommendedActions,
  });

  // ---- 5. Savings & investment agent ----
  let dailySavings = 0;
  await step("Savings & Investment Planner", () => {
    const monthlySurplus = risk.monthlyIncome - risk.monthlyExpenses;
    // Volunteer a safe slice of the surplus: 30% of surplus, at least ₹10 when positive
    dailySavings = monthlySurplus > 0
      ? Math.max(10, Math.round((monthlySurplus * 0.3) / 30 / 10) * 10)
      : 0;
  });

  // ---- 6. Bill payment agent ----
  let bills!: Array<{ name: string; monthlyAmount: number; months: number }>;
  await step("Bill Payment Tracker", () => {
    bills = detectRecurringBills(transactions);
  });

  // ---- 7. Goals agent ----
  let laggingGoals: Array<{ name: string; pct: number; needed: number }> = [];
  await step("Financial Goals Review", () => {
    laggingGoals = goals
      .filter(g => g.status !== "completed" && Number(g.target_amount) > 0)
      .map(g => ({
        name: g.goal_name,
        pct: Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100)),
        needed: Math.max(0, Number(g.target_amount) - Number(g.current_amount)),
      }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3);
  });

  // ---- 8. Recommendation agent (writes fresh recommendations) ----
  let recommendationsCount = 0;
  await step("Recommendation Engine", async () => {
    const recs: Array<Record<string, any>> = [];
    const monthsNeeded = Math.max(0, 6 - risk.emergencyFundCoverage);
    if (risk.emergencyFundCoverage < 3) {
      recs.push({
        recommendation_type: "savings",
        priority: "high",
        title: `Build your emergency fund to ${Math.min(6, Math.ceil(risk.emergencyFundCoverage + 1))}+ months`,
        description: `You have ${risk.emergencyFundCoverage.toFixed(1)} months of expenses covered${emergencyFund > 0 ? ` (${inr(emergencyFund)} across your accounts)` : " (no balance recorded)"}. Saving ${inr(dailySavings)}/day covers the gap in about ${monthsNeeded > 0 && dailySavings > 0 ? Math.ceil((monthsNeeded * risk.monthlyExpenses) / (dailySavings * 30)) : "?"} months.`,
        reasoning: "Gig income is volatile; below 3 months of cover one slow week can force debt.",
        action_items: ["Set up the daily auto-transfer suggested in Action Plan", "Keep the fund in a liquid savings account"],
        target_amount: Math.round(risk.monthlyExpenses * 6),
        confidence_score: 0.85,
        success_probability: 0.7,
        agent_source: "recommendation_agent",
      });
    }
    if (stats.incomeVolatility > 0.4) {
      recs.push({
        recommendation_type: "insight",
        priority: "high",
        title: "Smooth your feast & famine weeks",
        description: `Week-to-week income varies ${Math.round(stats.incomeVolatility * 100)}%. In feast weeks (~${inr(volatilityForecast.optimistic)}/week) park the extra; famine weeks (~${inr(volatilityForecast.pessimistic)}/week) draw it down instead of cutting essentials.`,
        reasoning: "Budgeting on average income fails when income swings this much.",
        action_items: ["Follow the Feast/Famine budgets just created"],
        confidence_score: 0.8,
        agent_source: "volatility_agent",
      });
    }
    const topCategory = Object.entries(stats.categoryExpenses).sort((a, b) => b[1] - a[1])[0];
    if (topCategory && stats.totalExpenses > 0) {
      const share = Math.round((topCategory[1] / stats.totalExpenses) * 100);
      recs.push({
        recommendation_type: "budget",
        priority: share > 35 ? "high" : "medium",
        title: `${topCategory[0]} is ${share}% of your spending`,
        description: `${inr(topCategory[1])} went to ${topCategory[0]} over ${stats.daysSpan} days (~${inr(topCategory[1] / Math.max(stats.daysSpan / 30, 0.5))}/month). Trimming it 10-15% frees ${inr(topCategory[1] * 0.12)}/month for savings.`,
        reasoning: "Largest category first gives the biggest savings lever.",
        action_items: [`Review ${topCategory[0]} transactions in the Transactions page`],
        confidence_score: 0.75,
        agent_source: "budget_agent",
      });
    }
    if (!tax.isTaxFree) {
      recs.push({
        recommendation_type: "tax",
        priority: "medium",
        title: `Set aside ${inr(tax.totalTaxLiability / 12)}/month for tax`,
        description: `Projected annual income ${inr(tax.annualGrossIncome)} → taxable ${inr(tax.taxableIncome)} under Sec 44AD presumptive taxation (6%). Estimated annual tax ${inr(tax.totalTaxLiability)} (incl. cess, after ${inr(tax.rebate87A)} 87A rebate). File ITR-4.`,
        reasoning: "Gig platforms don't deduct full TDS — reserving monthly avoids a year-end crunch.",
        action_items: ["Reserve tax monthly", "Check the Tax page for the full breakdown"],
        target_amount: tax.totalTaxLiability,
        confidence_score: 0.9,
        agent_source: "tax_agent",
      });
    } else {
      recs.push({
        recommendation_type: "tax",
        priority: "low",
        title: "You likely pay zero income tax this year",
        description: `Projected income ${inr(tax.annualGrossIncome)} falls under the Section 87A rebate threshold on the new regime with 44AD presumptive taxation. Still file ITR-4 to keep a clean record.`,
        reasoning: "Rebate makes tax liability nil at this income level.",
        confidence_score: 0.85,
        agent_source: "tax_agent",
      });
    }
    for (const bill of bills) {
      recs.push({
        recommendation_type: "bill",
        priority: "medium",
        title: `Recurring bill: ${bill.name} (~${inr(bill.monthlyAmount)}/month)`,
        description: `Detected ${bill.months} months of payments to ${bill.name}. Automate it so a busy gig week never makes you miss it.`,
        reasoning: "Recurring pattern detected in transaction history.",
        action_items: ["Enable auto-pay from your primary account"],
        confidence_score: 0.7,
        agent_source: "bill_payment_agent",
      });
    }
    for (const g of laggingGoals) {
      recs.push({
        recommendation_type: "goal",
        priority: g.pct < 25 ? "high" : "medium",
        title: `Goal "${g.name}" is ${g.pct}% funded`,
        description: `${inr(g.needed)} left. At ${inr(dailySavings)}/day it completes in about ${dailySavings > 0 ? Math.ceil(g.needed / (dailySavings * 30)) : "?"} months.`,
        reasoning: "Lowest-progress goals need attention first.",
        confidence_score: 0.75,
        agent_source: "goals_agent",
      });
    }
    await db.recommendations.replaceAll(recs);
    recommendationsCount = recs.length;
  });

  // ---- 9. Action agent (writes pending actions) ----
  let actionsCount = 0;
  await step("Action Planner", async () => {
    const existing = await db.actions.getAll();
    const existingDescriptions = new Set(existing.map(a => a.action_description));
    const actions: Array<Record<string, any>> = [];
    if (dailySavings > 0) {
      actions.push({
        action_type: "savings_transfer",
        action_description: `Auto-transfer ${inr(dailySavings)} daily surplus to emergency fund`,
        amount: dailySavings,
        schedule: "daily",
      });
    }
    if (!tax.isTaxFree) {
      actions.push({
        action_type: "tax_reserve",
        action_description: `Reserve ${inr(tax.totalTaxLiability / 12)} monthly for advance tax provision`,
        amount: Math.round(tax.totalTaxLiability / 12),
        schedule: "monthly",
      });
    }
    for (const bill of bills.slice(0, 2)) {
      actions.push({
        action_type: "bill_payment",
        action_description: `Schedule ${bill.name} payment (~${inr(bill.monthlyAmount)}/month)`,
        amount: bill.monthlyAmount,
        schedule: "monthly",
      });
    }
    for (const a of actions) {
      if (existingDescriptions.has(a.action_description)) continue; // no duplicates on re-run
      await db.actions.create(a);
      actionsCount += 1;
    }
  });

  return {
    healthScore: risk.healthScore,
    volatilityIndex: Math.round(stats.incomeVolatility * 100) / 100,
    emergencyFundMonths: Math.round(risk.emergencyFundCoverage * 10) / 10,
    monthlyTaxDue: Math.round(tax.totalTaxLiability / 12),
    dailySavings,
    recommendationsCount,
    actionsCount,
  };
}
