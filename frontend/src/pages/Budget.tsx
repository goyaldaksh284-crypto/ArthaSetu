import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, Plus, Edit, Trash2, Home, X } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import db from "@/services/database";
import { toast } from "sonner";
import { format, addDays, addMonths } from "date-fns";
import PageIntro from "@/components/PageIntro";
import HelpTooltip from "@/components/HelpTooltip";
import { hasMinimumTransactions, hasMinimumTransactionsSync } from "@/lib/dataRequirements";
import MinimumDataRequired from "@/components/MinimumDataRequired";
import db, { getLocal, DEFAULT_BUDGETS, DEFAULT_TRANSACTIONS } from "@/services/database";

const Budget = () => {
  const navigate = useNavigate();
  const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') || 'usr-demo-101' : 'usr-demo-101';
  const initialBudgets = getLocal<any[]>(`arthasetu_budgets_${userId}`, DEFAULT_BUDGETS);
  const [budgets, setBudgets] = useState<any[]>(initialBudgets);
  const [activeBudget, setActiveBudget] = useState<any | null>(initialBudgets[0] || null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMinimumData, setHasMinimumData] = useState(() => hasMinimumTransactionsSync());
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [transactions, setTransactions] = useState<any[]>(() => getLocal<any[]>(`arthasetu_txs_${userId}`, DEFAULT_TRANSACTIONS));
  const [formData, setFormData] = useState({
    budget_type: "monthly",
    valid_from: format(new Date(), "yyyy-MM-dd"),
    valid_until: format(addMonths(new Date(), 1), "yyyy-MM-dd"),
    total_income_expected: "",
    savings_target: "",
    discretionary_budget: "",
    fixed_costs: [] as Array<{ name: string; amount: string }>,
    variable_costs: [] as Array<{ category: string; amount: string }>,
    category_limits: [] as Array<{ category: string; limit: string }>,
  });

  useEffect(() => {
    checkDataRequirements();
  }, []);

  useEffect(() => {
    if (hasMinimumData) {
      loadData();
    }
  }, [hasMinimumData]);

  // Reload transactions when active budget changes
  useEffect(() => {
    if (activeBudget && hasMinimumData) {
      loadTransactionsForBudget();
    }
  }, [activeBudget?.budget_id, hasMinimumData]);

  const checkDataRequirements = async () => {
    try {
      const hasMinData = await hasMinimumTransactions();
      setHasMinimumData(hasMinData);
    } catch (error) {
      console.warn("Error checking data requirements:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Listen for focus events to refresh data when user returns to page
  useEffect(() => {
    const handleFocus = () => {
      if (activeBudget) {
        loadTransactionsForBudget();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [activeBudget]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const budgetsData = await db.budgets.getAll();
      setBudgets(budgetsData);
      
      const active = await db.budgets.getActive();
      setActiveBudget(active);
      
      // Load transactions for the active budget
      if (active) {
        await loadTransactionsForBudget(active);
      } else {
        // If no active budget, load recent transactions
        const transactionsData = await db.transactions.getAll({
          date_start: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
        });
        setTransactions(transactionsData);
      }
    } catch (error) {
      console.error("Failed to load budget data:", error);
      toast.error("Failed to load budget data");
    } finally {
      setIsLoading(false);
    }
  };

  const loadTransactionsForBudget = async (budget?: any) => {
    const targetBudget = budget || activeBudget;
    if (!targetBudget) return;

    try {
      // Load transactions within the budget's date range
      const transactionsData = await db.transactions.getAll({
        date_start: format(new Date(targetBudget.valid_from), "yyyy-MM-dd"),
        date_end: format(new Date(targetBudget.valid_until), "yyyy-MM-dd"),
      });
      setTransactions(transactionsData);
    } catch (error) {
      console.error("Failed to load transactions for budget:", error);
    }
  };

  // Calculate actual spending from transactions (case-insensitive category matching)
  const calculateActualSpending = (category: string) => {
    if (!category) return 0;
    return transactions
      .filter((t) => {
        if (t.transaction_type !== "expense") return false;
        // Case-insensitive category matching
        const transactionCategory = (t.category || "").toLowerCase().trim();
        const budgetCategory = category.toLowerCase().trim();
        return transactionCategory === budgetCategory;
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  };

  // Initialize form when editing
  useEffect(() => {
    if (activeBudget && isEditOpen) {
      // Safely parse dates
      let validFrom = format(new Date(), "yyyy-MM-dd");
      let validUntil = format(addMonths(new Date(), 1), "yyyy-MM-dd");
      
      try {
        if (activeBudget.valid_from) {
          const fromDate = typeof activeBudget.valid_from === 'string' 
            ? new Date(activeBudget.valid_from) 
            : activeBudget.valid_from;
          if (!isNaN(fromDate.getTime())) {
            validFrom = format(fromDate, "yyyy-MM-dd");
          }
        }
        if (activeBudget.valid_until) {
          const untilDate = typeof activeBudget.valid_until === 'string' 
            ? new Date(activeBudget.valid_until) 
            : activeBudget.valid_until;
          if (!isNaN(untilDate.getTime())) {
            validUntil = format(untilDate, "yyyy-MM-dd");
          }
        }
      } catch (e) {
        console.warn("Error parsing dates:", e);
      }

      setFormData({
        budget_type: activeBudget.budget_type || "monthly",
        valid_from: validFrom,
        valid_until: validUntil,
        total_income_expected: String(activeBudget.total_income_expected || ""),
        savings_target: String(activeBudget.savings_target || ""),
        discretionary_budget: String(activeBudget.discretionary_budget || ""),
        fixed_costs: Object.entries(activeBudget.fixed_costs || {}).map(([name, amount]) => ({
          name,
          amount: String(amount),
        })),
        variable_costs: Object.entries(activeBudget.variable_costs || {}).map(([category, amount]) => ({
          category,
          amount: String(amount),
        })),
        category_limits: Object.entries(activeBudget.category_limits || {}).map(([category, limit]) => ({
          category,
          limit: String(limit),
        })),
      });
    } else if (!activeBudget && isEditOpen) {
      // Reset form for new budget
      setFormData({
        budget_type: "monthly",
        valid_from: format(new Date(), "yyyy-MM-dd"),
        valid_until: format(addMonths(new Date(), 1), "yyyy-MM-dd"),
        total_income_expected: "",
        savings_target: "",
        discretionary_budget: "",
        fixed_costs: [],
        variable_costs: [],
        category_limits: [],
      });
    }
  }, [activeBudget, isEditOpen]);

  const handleSaveBudget = async () => {
    if (!formData.total_income_expected || !formData.valid_from || !formData.valid_until) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setIsSaving(true);

      // Convert form data to budget format
      const fixedCostsObj: Record<string, number> = {};
      formData.fixed_costs.forEach((cost) => {
        if (cost.name && cost.amount) {
          fixedCostsObj[cost.name] = parseFloat(cost.amount);
        }
      });

      const variableCostsObj: Record<string, number> = {};
      formData.variable_costs.forEach((cost) => {
        if (cost.category && cost.amount) {
          variableCostsObj[cost.category] = parseFloat(cost.amount);
        }
      });

      const categoryLimitsObj: Record<string, number> = {};
      formData.category_limits.forEach((limit) => {
        if (limit.category && limit.limit) {
          categoryLimitsObj[limit.category] = parseFloat(limit.limit);
        }
      });

      if (activeBudget) {
        // Update existing budget
        await db.budgets.update(activeBudget.budget_id, {
          budget_type: formData.budget_type,
          valid_from: formData.valid_from,
          valid_until: formData.valid_until,
          total_income_expected: parseFloat(formData.total_income_expected),
          fixed_costs: fixedCostsObj,
          variable_costs: variableCostsObj,
          savings_target: formData.savings_target ? parseFloat(formData.savings_target) : 0,
          discretionary_budget: formData.discretionary_budget ? parseFloat(formData.discretionary_budget) : 0,
          category_limits: categoryLimitsObj,
        });
        toast.success("Budget updated successfully!");
      } else {
        // Create new budget
        await db.budgets.create({
          budget_type: formData.budget_type,
          valid_from: formData.valid_from,
          valid_until: formData.valid_until,
          total_income_expected: parseFloat(formData.total_income_expected),
          fixed_costs: fixedCostsObj,
          variable_costs: variableCostsObj,
          savings_target: formData.savings_target ? parseFloat(formData.savings_target) : 0,
          discretionary_budget: formData.discretionary_budget ? parseFloat(formData.discretionary_budget) : 0,
          category_limits: categoryLimitsObj,
          is_active: true,
        });
        toast.success("Budget created successfully!");
      }

      setIsEditOpen(false);
      await loadData(); // Reload budgets
    } catch (error) {
      console.error("Failed to save budget:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save budget");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && budgets.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking data requirements...</p>
        </div>
      </div>
    );
  }

  if (!hasMinimumData) {
    return (
      <div className="space-y-6">
        <PageIntro
          title="Budget Planning"
          description="Create and manage your financial budgets"
        />
        <MinimumDataRequired featureName="Budget Analysis" />
      </div>
    );
  }

  const fixedCosts = (activeBudget?.fixed_costs || {}) as Record<string, number>;
  const variableCosts = (activeBudget?.variable_costs || {}) as Record<string, number>;
  const categoryLimits = (activeBudget?.category_limits || {}) as Record<string, number>;

  const totalFixed = Object.values(fixedCosts).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
  const totalVariable = Object.values(variableCosts).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
  const totalExpenses = totalFixed + totalVariable;
  const savings = (activeBudget?.total_income_expected || 0) - totalExpenses;

  return (
    <div className="space-y-6">
        {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")} title="Back to Home">
            <Home className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Budget Management</h1>
            <p className="text-muted-foreground">Plan and track your spending</p>
          </div>
        </div>
        <Button onClick={() => setIsEditOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Budget
        </Button>
      </div>

      {/* Budget Selector */}
      <Card className="p-4">
        <Select
          value={activeBudget?.budget_id || ""}
          onValueChange={(id) => {
            const budget = budgets.find((b) => b.budget_id === id);
            setActiveBudget(budget || null);
          }}
        >
          <SelectTrigger className="w-full md:w-[300px]">
            <SelectValue placeholder="Select a budget" />
          </SelectTrigger>
          <SelectContent>
            {budgets.map((budget) => (
              <SelectItem key={budget.budget_id} value={budget.budget_id}>
                {budget.budget_type || "Budget"} - {format(new Date(budget.valid_from), "MMM dd")} to{" "}
                {format(new Date(budget.valid_until), "MMM dd")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {activeBudget ? (
        <>
          {/* Budget Header with Edit Button */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                {activeBudget.budget_type || "Budget"} Budget
              </h2>
              <p className="text-sm text-muted-foreground">
                {format(new Date(activeBudget.valid_from), "MMM dd, yyyy")} - {format(new Date(activeBudget.valid_until), "MMM dd, yyyy")}
              </p>
            </div>
            <Button variant="outline" onClick={() => setIsEditOpen(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Budget
            </Button>
          </div>

        {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-2">Expected Income</p>
              <p className="text-2xl font-bold text-green-600">
                ₹{Number(activeBudget.total_income_expected || 0).toLocaleString("en-IN")}
              </p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-2">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">
                ₹{totalExpenses.toLocaleString("en-IN")}
              </p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-2">Savings Target</p>
              <p className="text-2xl font-bold">
                ₹{Number(activeBudget.savings_target || 0).toLocaleString("en-IN")}
              </p>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-sm text-muted-foreground">Discretionary</p>
                <HelpTooltip text="Money left after fixed bills and basics. This is the flexible amount you can choose how to use." />
              </div>
              <p className="text-2xl font-bold">
                ₹{Number(activeBudget.discretionary_budget || 0).toLocaleString("en-IN")}
              </p>
            </Card>
          </div>

          {/* Fixed Costs */}
          <Card className="p-6">
            <div className="flex items-center gap-1.5 mb-4">
              <h3 className="text-lg font-semibold">Fixed Costs</h3>
              <HelpTooltip text="Bills that stay almost the same every month, like rent or EMIs." />
            </div>
            <div className="space-y-3">
              {Object.entries(fixedCosts).map(([name, amount]) => (
                <div key={name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{name}</p>
                  </div>
                  <p className="font-semibold">₹{Number(amount).toLocaleString("en-IN")}</p>
                </div>
              ))}
              {Object.keys(fixedCosts).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No fixed costs defined</p>
              )}
            </div>
          </Card>

          {/* Variable Costs */}
          <Card className="p-6">
            <div className="flex items-center gap-1.5 mb-4">
              <h3 className="text-lg font-semibold">Variable Costs</h3>
              <HelpTooltip text="Spending that changes month to month, like fuel, food, or shopping." />
            </div>
            <div className="space-y-3">
              {Object.entries(variableCosts).map(([category, amount]) => {
                const actual = calculateActualSpending(category);
                const amountNum = Number(amount) || 0;
                const percentage = amountNum > 0 ? (actual / amountNum) * 100 : 0;
                const isOverBudget = percentage > 100;
                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{category}</span>
                      <span className={`text-sm ${isOverBudget ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                        ₹{actual.toLocaleString("en-IN")} / ₹{amountNum.toLocaleString("en-IN")}
                        {isOverBudget && " (Over budget!)"}
                      </span>
            </div>
                    <Progress 
                      value={Math.min(percentage, 100)} 
                      className={`h-2 ${isOverBudget ? "[&>div]:bg-red-600" : ""}`}
                    />
            </div>
                );
              })}
              {Object.keys(variableCosts).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No variable costs defined</p>
              )}
            </div>
          </Card>

          {/* Category Limits */}
          <Card className="p-6">
            <div className="flex items-center gap-1.5 mb-4">
              <h3 className="text-lg font-semibold">Category Limits</h3>
              <HelpTooltip text="Maximum amount you plan to spend in each category for this period." />
            </div>
            <div className="space-y-3">
              {Object.entries(categoryLimits).map(([category, limit]: [string, any]) => {
                const actual = calculateActualSpending(category);
                const limitNum = Number(limit) || 0;
                const percentage = limitNum > 0 ? (actual / limitNum) * 100 : 0;
                const isOverBudget = percentage > 100;
                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{category}</span>
                      <span className={`text-sm ${isOverBudget ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                        ₹{actual.toLocaleString("en-IN")} / ₹{limitNum.toLocaleString("en-IN")}
                        {isOverBudget && " (Over limit!)"}
                </span>
              </div>
                    <Progress 
                      value={Math.min(percentage, 100)} 
                      className={`h-2 ${isOverBudget ? "[&>div]:bg-red-600" : ""}`}
                    />
                  </div>
                );
              })}
              {Object.keys(categoryLimits).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No category limits defined</p>
              )}
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-lg font-semibold mb-2">No active budget</p>
          <p className="text-muted-foreground mb-4">Create a budget to start tracking your spending</p>
          <Button onClick={() => setIsEditOpen(true)}>Create Budget</Button>
          </Card>
      )}

      {/* Create/Edit Budget Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activeBudget ? "Edit Budget" : "Create Budget"}</DialogTitle>
            <DialogDescription>
              Set up your budget for the selected period. Define your income, expenses, and savings goals.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Budget Type *</Label>
                <Select
                  value={formData.budget_type}
                  onValueChange={(v) => setFormData({ ...formData, budget_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="feast_famine">Feast/Famine</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expected Income (₹) *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.total_income_expected}
                  onChange={(e) => setFormData({ ...formData, total_income_expected: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From *</Label>
                <Input
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valid Until *</Label>
                <Input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                />
                    </div>
                  </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Savings Target (₹)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.savings_target}
                  onChange={(e) => setFormData({ ...formData, savings_target: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>Discretionary Budget (₹)</Label>
                  <HelpTooltip text="Money left after fixed bills and basics. This is the flexible amount you can choose how to use." />
                </div>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.discretionary_budget}
                  onChange={(e) => setFormData({ ...formData, discretionary_budget: e.target.value })}
                />
                    </div>
                  </div>

            {/* Fixed Costs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Label>Fixed Costs</Label>
                  <HelpTooltip text="Bills that stay almost the same every month, like rent or EMIs." />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData({
                    ...formData,
                    fixed_costs: [...formData.fixed_costs, { name: "", amount: "" }]
                  })}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
                </div>
              {formData.fixed_costs.map((cost, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    placeholder="Cost name (e.g., Rent)"
                    value={cost.name}
                    onChange={(e) => {
                      const newCosts = [...formData.fixed_costs];
                      newCosts[idx].name = e.target.value;
                      setFormData({ ...formData, fixed_costs: newCosts });
                    }}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={cost.amount}
                    onChange={(e) => {
                      const newCosts = [...formData.fixed_costs];
                      newCosts[idx].amount = e.target.value;
                      setFormData({ ...formData, fixed_costs: newCosts });
                    }}
                    className="w-32"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newCosts = formData.fixed_costs.filter((_, i) => i !== idx);
                      setFormData({ ...formData, fixed_costs: newCosts });
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  </div>
              ))}
            </div>

            {/* Variable Costs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Label>Variable Costs</Label>
                  <HelpTooltip text="Spending that changes month to month, like fuel, food, or shopping." />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData({
                    ...formData,
                    variable_costs: [...formData.variable_costs, { category: "", amount: "" }]
                  })}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              {formData.variable_costs.map((cost, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    placeholder="Category (e.g., Food)"
                    value={cost.category}
                    onChange={(e) => {
                      const newCosts = [...formData.variable_costs];
                      newCosts[idx].category = e.target.value;
                      setFormData({ ...formData, variable_costs: newCosts });
                    }}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={cost.amount}
                    onChange={(e) => {
                      const newCosts = [...formData.variable_costs];
                      newCosts[idx].amount = e.target.value;
                      setFormData({ ...formData, variable_costs: newCosts });
                    }}
                    className="w-32"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newCosts = formData.variable_costs.filter((_, i) => i !== idx);
                      setFormData({ ...formData, variable_costs: newCosts });
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Category Limits */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Label>Category Limits</Label>
                  <HelpTooltip text="Maximum amount you plan to spend in each category for this period." />
              </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData({
                    ...formData,
                    category_limits: [...formData.category_limits, { category: "", limit: "" }]
                  })}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
            </div>
              {formData.category_limits.map((limit, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    placeholder="Category (e.g., Groceries)"
                    value={limit.category}
                    onChange={(e) => {
                      const newLimits = [...formData.category_limits];
                      newLimits[idx].category = e.target.value;
                      setFormData({ ...formData, category_limits: newLimits });
                    }}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Limit"
                    value={limit.limit}
                    onChange={(e) => {
                      const newLimits = [...formData.category_limits];
                      newLimits[idx].limit = e.target.value;
                      setFormData({ ...formData, category_limits: newLimits });
                    }}
                    className="w-32"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newLimits = formData.category_limits.filter((_, i) => i !== idx);
                      setFormData({ ...formData, category_limits: newLimits });
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
              </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSaveBudget}
                disabled={isSaving || !formData.total_income_expected || !formData.valid_from || !formData.valid_until}
                className="flex-1"
              >
                {isSaving ? "Saving..." : activeBudget ? "Update Budget" : "Create Budget"}
        </Button>
      </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Budget;
