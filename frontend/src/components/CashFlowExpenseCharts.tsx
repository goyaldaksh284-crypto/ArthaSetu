import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  type ChartOptions,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

export interface CashFlowExpenseChartsProps {
  income?: number;
  expenses?: number;
  savings?: number;
  categoryExpenses?: Record<string, number>;
  onEditClick?: () => void;
  className?: string;
}

export const CashFlowExpenseCharts: React.FC<CashFlowExpenseChartsProps> = ({
  income,
  expenses,
  savings,
  categoryExpenses,
  onEditClick,
  className = '',
}) => {
  // Check dark mode
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  // Baseline data matching Fin_service reference design
  const defaultIncome = 195000;
  const defaultExpenses = 106000;
  const defaultSavings = 89000;

  const defaultCategoryExpenses: Record<string, number> = {
    Rent: 38000,
    Grocery: 14000,
    Dining: 12000,
    Shopping: 8000,
    Transport: 7000,
    Other: 27000,
  };

  const totalIncome = typeof income === 'number' && income > 0 ? income : defaultIncome;
  const totalExpenses = typeof expenses === 'number' && expenses > 0 ? expenses : defaultExpenses;
  const totalSavings = typeof savings === 'number' && savings > 0 ? savings : Math.max(0, totalIncome - totalExpenses);

  const activeCategoryExpenses = categoryExpenses && Object.keys(categoryExpenses).length > 0
    ? categoryExpenses
    : defaultCategoryExpenses;

  // Formatting helpers matching Fin_service
  const formatCurrency = (amount: number) => {
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  };

  const formatCompactCurrency = (amount: number) => {
    const num = Number(amount);
    if (!Number.isFinite(num) || num === 0) return '₹0';
    if (Math.abs(num) >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
    if (Math.abs(num) >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
    if (Math.abs(num) >= 1000) return `₹${(num / 1000).toFixed(1)}k`;
    return `₹${num.toLocaleString('en-IN')}`;
  };

  // Color palettes extracted directly from Fin_service
  const expensePalette = useMemo(() => (
    isDark ? [
      '#FAFAFA',
      '#D4D4D8',
      '#A1A1AA',
      '#71717A',
      '#52525B',
      '#3F3F46',
      '#27272A',
      '#18181B'
    ] : [
      '#0F172A', // Rent
      '#334155', // Grocery
      '#475569', // Dining
      '#64748B', // Shopping
      '#94A3B8', // Transport
      '#CBD5E1', // Other
      '#E2E8F0',
      '#F1F5F9'
    ]
  ), [isDark]);

  // Chart configuration with smooth animation options from Fin_service
  const chartOptions = useMemo(() => {
    const textColor = isDark ? '#A1A1AA' : '#64748B';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';

    return {
      bar: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1000,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: isDark ? '#18181B' : '#0F172A',
            titleColor: '#FAFAFA',
            bodyColor: '#D4D4D8',
            cornerRadius: 12,
            padding: 10,
            callbacks: {
              label: (context: any) => ` ₹${(Number(context.parsed.y) || 0).toLocaleString('en-IN')}`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: textColor,
              font: { size: 12, family: 'Inter, sans-serif' },
            },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: textColor,
              font: { size: 11, family: 'Inter, sans-serif' },
              callback: (value: any) => Number(value).toLocaleString('en-IN'),
            },
            grid: { color: gridColor },
          },
        },
      } as ChartOptions<'bar'>,
      doughnut: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 1200,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: isDark ? '#18181B' : '#0F172A',
            titleColor: '#FAFAFA',
            bodyColor: '#D4D4D8',
            cornerRadius: 10,
            padding: 8,
            callbacks: {
              label: (context: any) => {
                const value = Number(context.parsed) || 0;
                const total = (context.dataset.data as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                return ` ₹${value.toLocaleString('en-IN')} (${percentage}%)`;
              },
            },
          },
        },
      } as ChartOptions<'doughnut'>,
    };
  }, [isDark]);

  // Cash flow chart data (3 rounded pill bars)
  const monthlyCashFlowData = useMemo(() => ({
    labels: ['Income', 'Expenses', 'Savings'],
    datasets: [
      {
        data: [totalIncome, totalExpenses, totalSavings],
        backgroundColor: isDark ? [
          '#FAFAFA',
          '#71717A',
          '#27272A'
        ] : [
          '#0F172A',
          '#94A3B8',
          '#CBD5E1'
        ],
        borderRadius: 12,
        barPercentage: 0.55,
      },
    ],
  }), [totalIncome, totalExpenses, totalSavings, isDark]);

  // Process and sort expense entries
  const expenseEntries = useMemo(() => {
    return Object.entries(activeCategoryExpenses)
      .filter(([, amt]) => amt > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [activeCategoryExpenses]);

  // Group remainder into 'Other' if more than 5 categories
  const displayExpenseEntries = useMemo(() => {
    if (expenseEntries.length === 0) return [];
    if (expenseEntries.length > 5) {
      const top5 = expenseEntries.slice(0, 5);
      const remaining = expenseEntries.slice(5);
      const remainingTotal = remaining.reduce((sum, [, amt]) => sum + amt, 0);
      return [...top5, [`Other (${remaining.length} items)`, remainingTotal] as [string, number]];
    }
    return expenseEntries;
  }, [expenseEntries]);

  // Doughnut dataset
  const expensesData = useMemo(() => {
    if (displayExpenseEntries.length === 0) {
      return { labels: [], datasets: [] };
    }

    return {
      labels: displayExpenseEntries.map(([category]) => category),
      datasets: [
        {
          data: displayExpenseEntries.map(([, amount]) => amount),
          backgroundColor: displayExpenseEntries.map((_, i) => expensePalette[i % expensePalette.length]),
          borderWidth: 2,
          borderColor: isDark ? '#121214' : '#FFFFFF',
        },
      ],
    };
  }, [displayExpenseEntries, expensePalette, isDark]);

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${className}`}>
      {/* Monthly Cash Flow Rounded Bar Chart */}
      <div className="lg:col-span-6 bg-card rounded-3xl border border-border/80 p-5 sm:p-6 shadow-card min-w-0 transition-all duration-300">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Monthly Cash Flow</h3>
            <p className="text-2xs text-muted-foreground">Income vs Expenses vs Savings</p>
          </div>
          <div className="flex items-center gap-3 text-2xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-foreground" /> Income
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/60" /> Expenses
            </span>
          </div>
        </div>
        <div className="h-64 sm:h-72">
          <Bar data={monthlyCashFlowData} options={chartOptions.bar} />
        </div>
      </div>

      {/* Expense Distribution Doughnut with Center Total & Crisp HTML Legend */}
      <div className="lg:col-span-6 bg-card rounded-3xl border border-border/80 p-5 sm:p-6 shadow-card flex flex-col justify-between min-w-0 transition-all duration-300">
        <div>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="text-sm font-bold text-foreground">Expense Breakdown</h3>
              <p className="text-2xs text-muted-foreground">Categorized monthly outflow</p>
            </div>
            {expenseEntries.length > 5 && (
              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/60">
                Top 5 + Other
              </span>
            )}
          </div>

          {displayExpenseEntries.length > 0 ? (
            <div className="mt-4 flex flex-col sm:flex-row items-center gap-6 min-w-0">
              {/* Doughnut Chart Canvas with Center Readout */}
              <div className="relative w-40 h-40 sm:w-44 sm:h-44 shrink-0 flex items-center justify-center">
                <Doughnut data={expensesData} options={chartOptions.doughnut} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
                    Total
                  </span>
                  <span className="text-xs sm:text-sm font-black text-foreground">
                    {formatCompactCurrency(totalExpenses)}
                  </span>
                </div>
              </div>

              {/* Crisp HTML Legend (Never Truncated, Always Legible) */}
              <div className="flex-1 w-full space-y-2 overflow-y-auto max-h-52 pr-1 min-w-0">
                {displayExpenseEntries.map(([category, amount], idx) => {
                  const pct = totalExpenses > 0
                    ? ((amount / totalExpenses) * 100).toFixed(1)
                    : '0.0';
                  return (
                    <div key={category} className="flex items-center justify-between text-xs py-0.5 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: expensePalette[idx % expensePalette.length] }}
                        />
                        <span
                          className="text-foreground font-medium truncate text-2xs sm:text-xs"
                          title={category}
                        >
                          {category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-foreground text-2xs sm:text-xs">
                          {formatCurrency(amount)}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground w-11 text-right">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
              No expenses recorded
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-border/60 flex items-center justify-between text-2xs text-muted-foreground mt-4">
          <span>Total Outflow: <strong className="text-foreground">{formatCurrency(totalExpenses)}</strong></span>
          {onEditClick ? (
            <button
              onClick={onEditClick}
              className="font-semibold text-foreground hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Edit</span>
              <span>&rarr;</span>
            </button>
          ) : (
            <Link
              to="/transactions"
              className="font-semibold text-foreground hover:underline inline-flex items-center gap-1"
            >
              <span>Edit</span>
              <span>&rarr;</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default CashFlowExpenseCharts;
