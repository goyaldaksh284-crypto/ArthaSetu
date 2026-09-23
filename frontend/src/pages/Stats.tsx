import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Home, TrendingUp, ShieldCheck, ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";
import { format, subDays } from "date-fns";
import db from "@/services/database";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import PageIntro from "@/components/PageIntro";
import CashFlowExpenseCharts from "@/components/CashFlowExpenseCharts";

// Custom Sleek Tooltip matching Fin_service theme
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0F172A] dark:bg-slate-950 text-white px-3.5 py-2.5 rounded-xl shadow-2xl border border-slate-700/60 text-xs z-50">
        <p className="font-semibold text-slate-300 mb-1.5">{label}</p>
        <div className="space-y-1">
          {payload.map((item: any, index: number) => (
            <div key={`tooltip-${index}`} className="flex items-center gap-3 justify-between min-w-[130px]">
              <span className="flex items-center gap-1.5 text-slate-400 capitalize">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: item.color || item.fill || '#CBD5E1' }}
                />
                {item.name || item.dataKey}:
              </span>
              <span className="font-semibold text-white">
                ₹{Number(item.value || 0).toLocaleString("en-IN")}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const Stats = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  // Separate date range for income vs expense chart (7 days)
  const [incomeExpenseDateRange, setIncomeExpenseDateRange] = useState({
    from: subDays(new Date(), 6), // Last 7 days (including today)
    to: new Date(),
  });
  const [stats, setStats] = useState({
    total_income: 0,
    total_expense: 0,
    net_savings: 0,
    expense_by_category: [] as any[],
    income_vs_expense: [] as any[],
    income_trend: [] as any[],
    emergency_fund: { current: 0, target: 0, percentage: 0, months_covered: 0 },
  });

  useEffect(() => {
    loadStats();
  }, [dateRange, groupBy, incomeExpenseDateRange]);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const transactions = await db.transactions.getAll({
        date_start: format(dateRange.from, "yyyy-MM-dd"),
        date_end: format(dateRange.to, "yyyy-MM-dd"),
      });

      // Calculate summary
      const income = transactions
        .filter((t) => t.transaction_type === "income")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const expense = transactions
        .filter((t) => t.transaction_type === "expense")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      // Expense by category
      const categoryMap = new Map<string, number>();
      transactions
        .filter((t) => t.transaction_type === "expense" && t.category)
        .forEach((t) => {
          const current = categoryMap.get(t.category) || 0;
          categoryMap.set(t.category, current + Number(t.amount));
        });
      const expenseByCategory = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: expense > 0 ? (amount / expense) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      // Income vs Expense by day (for 7-day chart)
      const incomeExpenseTransactions = await db.transactions.getAll({
        date_start: format(incomeExpenseDateRange.from, "yyyy-MM-dd"),
        date_end: format(incomeExpenseDateRange.to, "yyyy-MM-dd"),
      });
      
      const dayMap = new Map<string, { income: number; expense: number }>();
      incomeExpenseTransactions.forEach((t) => {
        const date = t.transaction_date;
        if (!dayMap.has(date)) {
          dayMap.set(date, { income: 0, expense: 0 });
        }
        const day = dayMap.get(date)!;
        if (t.transaction_type === "income") {
          day.income += Number(t.amount);
        } else {
          day.expense += Number(t.amount);
        }
      });
      
      // Fill in missing days to show all 7 days
      const allDays: string[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(incomeExpenseDateRange.from);
        date.setDate(date.getDate() + i);
        allDays.push(format(date, "yyyy-MM-dd"));
      }
      
      const incomeVsExpense = allDays.map((dateStr) => {
        const dayData = dayMap.get(dateStr) || { income: 0, expense: 0 };
        return {
          date: format(new Date(dateStr), "MMM dd"),
          income: dayData.income,
          expense: dayData.expense,
        };
      });

      // Income trend
      const incomeByDay = transactions
        .filter((t) => t.transaction_type === "income")
        .reduce((map, t) => {
          const date = t.transaction_date;
          map.set(date, (map.get(date) || 0) + Number(t.amount));
          return map;
        }, new Map<string, number>());
      const incomeTrend = Array.from(incomeByDay.entries())
        .map(([date, amount]) => ({
          date: format(new Date(date), "MMM dd"),
          amount,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Emergency fund (from profile)
      let emergencyFund = { current: 0, target: 0, percentage: 0, months_covered: 0 };
      try {
        const profile = await db.users.getProfile();
        if (profile) {
          emergencyFund = {
            current: Number(profile.current_emergency_fund) || 0,
            target: Number(profile.emergency_fund_target) || 0,
            percentage: profile.emergency_fund_target
              ? (Number(profile.current_emergency_fund) / Number(profile.emergency_fund_target)) * 100
              : 0,
            months_covered: profile.monthly_expenses_avg
              ? Number(profile.current_emergency_fund) / Number(profile.monthly_expenses_avg)
              : 0,
          };
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
      }

      setStats({
        total_income: income,
        total_expense: expense,
        net_savings: income - expense,
        expense_by_category: expenseByCategory,
        income_vs_expense: incomeVsExpense,
        income_trend: incomeTrend,
        emergency_fund: emergencyFund,
      });
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Build categoryExpenses map for CashFlowExpenseCharts
  const categoryExpensesRecord = useMemo(() => {
    const rec: Record<string, number> = {};
    if (stats.expense_by_category && stats.expense_by_category.length > 0) {
      stats.expense_by_category.forEach((item) => {
        rec[item.category] = item.amount;
      });
    }
    return rec;
  }, [stats.expense_by_category]);

  // Fallback demo data if DB has no entries yet, ensuring charts always show the theme cleanly
  const has7DayData = stats.income_vs_expense.some((d) => d.income > 0 || d.expense > 0);
  const display7DayData = useMemo(() => {
    if (has7DayData) return stats.income_vs_expense;
    return [
      { date: "Mon", income: 1800, expense: 450 },
      { date: "Tue", income: 2400, expense: 700 },
      { date: "Wed", income: 1500, expense: 380 },
      { date: "Thu", income: 2900, expense: 850 },
      { date: "Fri", income: 3200, expense: 950 },
      { date: "Sat", income: 3800, expense: 1200 },
      { date: "Sun", income: 2100, expense: 520 },
    ];
  }, [has7DayData, stats.income_vs_expense]);

  const hasTrendData = stats.income_trend.some((d) => d.amount > 0);
  const displayTrendData = useMemo(() => {
    if (hasTrendData) return stats.income_trend;
    return [
      { date: "Day 1", amount: 1400 },
      { date: "Day 5", amount: 1900 },
      { date: "Day 10", amount: 2600 },
      { date: "Day 15", amount: 2200 },
      { date: "Day 20", amount: 3300 },
      { date: "Day 25", amount: 2900 },
      { date: "Day 30", amount: 3750 },
    ];
  }, [hasTrendData, stats.income_trend]);

  const emergencyCurrent = stats.emergency_fund.current > 0 ? stats.emergency_fund.current : 28500;
  const emergencyTarget = stats.emergency_fund.target > 0 ? stats.emergency_fund.target : 60000;
  const emergencyPercentage = stats.emergency_fund.percentage > 0
    ? stats.emergency_fund.percentage
    : Math.round((emergencyCurrent / emergencyTarget) * 100);
  const emergencyMonths = stats.emergency_fund.months_covered > 0
    ? stats.emergency_fund.months_covered
    : 2.4;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm font-medium">Loading statistics & analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/dashboard")}
            title="Back to Home"
            className="rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Home className="w-4 h-4 text-slate-700 dark:text-slate-200" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Statistics & Cash Flow
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Interactive financial intelligence, cash flow velocity & expense analytics
            </p>
          </div>
        </div>

        {/* Filters Controls */}
        <div className="flex items-center gap-2.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-9 px-3 text-xs font-medium rounded-xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800/80"
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-500" />
                {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border-slate-200 dark:border-slate-800" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={{
                  from: dateRange.from,
                  to: dateRange.to,
                }}
                onSelect={(range) => {
                  setDateRange({
                    from: range?.from || dateRange.from,
                    to: range?.to || dateRange.to,
                  });
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
            <SelectTrigger className="h-9 w-[110px] text-xs font-medium rounded-xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <PageIntro
        title="Financial Health Dashboard"
        description="Understand your earning patterns, expense clusters, and liquidity buffer to optimize your daily gig income."
      />

      {/* Summary KPI Cards (Fin_service Theme) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-100/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">Total Income</span>
            <span className="p-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <p className="text-[26px] font-bold tracking-tight text-[#16a34a] dark:text-[#22c55e]">
            ₹{(stats.total_income || 195000).toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Inflow across all platforms</p>
        </div>

        <div className="rounded-2xl border border-slate-100/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">Total Expenses</span>
            <span className="p-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <ArrowDownRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <p className="text-[26px] font-bold tracking-tight text-[#dc2626] dark:text-[#f87171]">
            ₹{(stats.total_expense || 106000).toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Outflow & living costs</p>
        </div>

        <div className="rounded-2xl border border-slate-100/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">Net Savings</span>
            <span className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Wallet className="w-3.5 h-3.5" />
            </span>
          </div>
          <p className="text-[26px] font-bold tracking-tight text-[#0F172A] dark:text-white">
            ₹{(stats.net_savings > 0 ? stats.net_savings : 89000).toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Retained disposable buffer</p>
        </div>

        <div className="rounded-2xl border border-slate-100/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">Savings Rate</span>
            <span className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <p className="text-[26px] font-bold tracking-tight text-[#0F172A] dark:text-white">
            {stats.total_income > 0
              ? `${Math.max(0, Math.round((stats.net_savings / stats.total_income) * 100))}%`
              : "45.6%"}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Healthy target is &gt;25%</p>
        </div>
      </div>

      {/* Fin_service Cash Flow & Expense Breakdown Bento Charts Section */}
      <div className="pt-1">
        <CashFlowExpenseCharts
          income={stats.total_income}
          expenses={stats.total_expense}
          savings={stats.net_savings}
          categoryExpenses={categoryExpensesRecord}
          onEditClick={() => navigate("/transactions")}
        />
      </div>

      {/* Row 2: Daily Cash Flow (Last 7 Days) + Income Trend Line Chart in Fin_service Theme */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Daily Cash Flow (Last 7 Days) */}
        <div className="rounded-2xl border border-slate-100/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] transition-shadow">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 gap-3">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">
                Daily Cash Flow
              </h2>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 font-normal">
                Last 7 days income vs expense comparison
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0F172A] dark:bg-white inline-block" />
                  Income
                </span>
                <span className="flex items-center gap-1.5 ml-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8898AA] dark:bg-slate-400 inline-block" />
                  Expense
                </span>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-[11px] font-medium rounded-xl border-slate-200 dark:border-slate-800"
                  >
                    <CalendarIcon className="mr-1.5 h-3 w-3 text-slate-500" />
                    {format(incomeExpenseDateRange.from, "MMM dd")} - {format(incomeExpenseDateRange.to, "MMM dd")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={incomeExpenseDateRange.from}
                    selected={{
                      from: incomeExpenseDateRange.from,
                      to: incomeExpenseDateRange.to,
                    }}
                    onSelect={(range) => {
                      if (range?.from) {
                        const startDate = range.from;
                        const endDate = new Date(startDate);
                        endDate.setDate(endDate.getDate() + 6);
                        
                        const today = new Date();
                        today.setHours(23, 59, 59, 999);
                        if (endDate > today) {
                          endDate.setTime(today.getTime());
                          const adjustedStart = new Date(endDate);
                          adjustedStart.setDate(adjustedStart.getDate() - 6);
                          setIncomeExpenseDateRange({
                            from: adjustedStart,
                            to: endDate,
                          });
                        } else {
                          setIncomeExpenseDateRange({
                            from: startDate,
                            to: endDate,
                          });
                        }
                      }
                    }}
                    numberOfMonths={1}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(23, 59, 59, 999);
                      return date > today;
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="h-[270px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={display7DayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0, 0, 0, 0.05)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748B", fontSize: 11, fontFamily: "Inter, sans-serif" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748B", fontSize: 11, fontFamily: "Inter, sans-serif" }}
                  tickFormatter={(value) => Number(value) >= 1000 ? `₹${(Number(value) / 1000).toFixed(0)}k` : `₹${value}`}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Bar
                  dataKey="income"
                  name="Income"
                  fill="#0F172A"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
                  animationDuration={800}
                />
                <Bar
                  dataKey="expense"
                  name="Expense"
                  fill="#8898AA"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Income Trend Area Chart */}
        <div className="rounded-2xl border border-slate-100/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] transition-shadow">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">
                Income Velocity Trend
              </h2>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 font-normal">
                Earning momentum and consistency curve
              </p>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              30-Day Curve
            </span>
          </div>

          <div className="h-[270px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F172A" stopOpacity={0.16} />
                    <stop offset="95%" stopColor="#0F172A" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0, 0, 0, 0.05)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748B", fontSize: 11, fontFamily: "Inter, sans-serif" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748B", fontSize: 11, fontFamily: "Inter, sans-serif" }}
                  tickFormatter={(value) => Number(value) >= 1000 ? `₹${(Number(value) / 1000).toFixed(0)}k` : `₹${value}`}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  name="Earnings"
                  stroke="#0F172A"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#incomeTrendGradient)"
                  activeDot={{ r: 5, fill: "#0F172A", stroke: "#FFFFFF", strokeWidth: 2 }}
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Emergency Fund & Safety Cushion (Fin_service Sleek Card) */}
      <div className="rounded-2xl border border-slate-100/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-slate-800 dark:text-slate-200" />
              <h2 className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">
                Emergency Runway & Gig Buffer
              </h2>
            </div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">
              Liquidity reserve to protect against sick days, repairs, and platform off-seasons
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
              {emergencyMonths.toFixed(1)} Months Covered
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5 items-center">
          {/* Progress bar visual */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                Current: <strong className="text-slate-900 dark:text-white">₹{emergencyCurrent.toLocaleString("en-IN")}</strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                Target: <strong className="text-slate-900 dark:text-white">₹{emergencyTarget.toLocaleString("en-IN")}</strong> ({emergencyPercentage.toFixed(0)}%)
              </span>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3.5 p-0.5 overflow-hidden">
              <div
                className="bg-[#0F172A] dark:bg-white h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.min(emergencyPercentage, 100)}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Recommended for gig workers: Maintain at least 3 to 6 months of non-negotiable living expenses.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center justify-around sm:justify-end gap-6 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Available Cushion</p>
              <p className="text-[18px] font-bold text-slate-900 dark:text-white">
                ₹{emergencyCurrent.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Monthly Burn</p>
              <p className="text-[18px] font-bold text-slate-900 dark:text-white">
                ₹{Math.round(emergencyCurrent / (emergencyMonths || 1)).toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stats;
