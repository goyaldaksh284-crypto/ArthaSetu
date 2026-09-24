import { useState, useMemo, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, Edit, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import db, { getLocal, DEFAULT_TRANSACTIONS } from "@/services/database";
import { toast } from "sonner";
import PageIntro from "@/components/PageIntro";

const Transactions = () => {
  const { isAuthenticated } = useApp();
  const getInitialTxs = () => {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') || 'usr-demo-101' : 'usr-demo-101';
    return getLocal<any[]>(`arthasetu_txs_${userId}`, DEFAULT_TRANSACTIONS);
  };
  const [transactions, setTransactions] = useState<any[]>(getInitialTxs);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [deleteTransaction, setDeleteTransaction] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadTransactions();
    }
  }, [isAuthenticated, dateRange.from, dateRange.to]);

  const loadTransactions = async () => {
    try {
      const data = await db.transactions.getAll({
        date_start: dateRange.from?.toISOString().split('T')[0],
        date_end: dateRange.to?.toISOString().split('T')[0],
      });
      if (data && data.length > 0) {
        setTransactions(data);
      }
    } catch (error) {
      console.warn("Failed to load transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(transactions.map((t) => t.category).filter(Boolean));
    return Array.from(cats);
  }, [transactions]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Date range filter
    if (dateRange.from) {
      filtered = filtered.filter((t) => new Date(t.transaction_date) >= dateRange.from!);
    }
    if (dateRange.to) {
      filtered = filtered.filter((t) => new Date(t.transaction_date) <= dateRange.to!);
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((t) => t.transaction_type === typeFilter);
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((t) => t.category === categoryFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.category?.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.merchant_name?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [transactions, dateRange, typeFilter, categoryFilter, searchQuery]);

  // Group by date
  const groupedTransactions = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    filteredTransactions.forEach((t) => {
      const date = t.transaction_date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(t);
    });
    return grouped;
  }, [filteredTransactions]);

  // Today's summary
  const today = new Date().toISOString().split("T")[0];
  const todayTransactions = transactions.filter((t) => t.transaction_date === today);
  const todayIncome = todayTransactions
    .filter((t) => t.transaction_type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const todayExpense = todayTransactions
    .filter((t) => t.transaction_type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const handleEdit = (transaction: any) => {
    setEditingTransaction(transaction);
    setIsEditDialogOpen(true);
  };

      const handleDelete = (id: string) => {
        setDeleteTransaction(id);
      };

      const confirmDelete = async () => {
        if (!deleteTransaction) return;
        try {
          await db.transactions.delete(deleteTransaction);
          toast.success("Transaction deleted successfully!");
          setDeleteTransaction(null);
          loadTransactions();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to delete transaction");
        }
      };

  if (isLoading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading transactions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="text-6xl">🔐</div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
            <p className="text-muted-foreground">Please log in to view your transactions.</p>
          </div>
        </div>
      </div>
    );
  }

  // Show empty state if no transactions
  if (transactions.length === 0) {
    return (
      <div className="space-y-6">
        <PageIntro
          title="Transactions"
          description="Track and manage your financial transactions"
        />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-6xl mb-4">💳</div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Welcome! You just logged in</h3>
              <p className="text-muted-foreground mb-4">
                You don't have any transactions yet. Start by adding your first transaction to begin tracking your financial journey.
              </p>
              <Button onClick={() => window.location.href = '/dashboard'} className="bg-primary text-primary-foreground">
                Go to Dashboard to Add Transactions
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full md:w-[250px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from && dateRange.to ? (
                  `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
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
                    from: range?.from,
                    to: range?.to,
                  });
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </Card>

      <PageIntro
        title="What is this page?"
        description="This page shows every income and expense entry you've recorded. Use it to review, search, and edit past transactions."
      />

      {/* Today's Summary */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10">
        <h2 className="text-xl font-bold mb-4">Today's Summary</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Income</p>
            <p className="text-2xl font-bold text-green-600">₹{todayIncome.toLocaleString("en-IN")}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Expense</p>
            <p className="text-2xl font-bold text-red-600">₹{todayExpense.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </Card>

      {/* Today's Transactions */}
      {todayTransactions.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Today</h2>
          <Card>
            <div className="divide-y">
              {todayTransactions.map((transaction) => (
                <TransactionRow
                  key={transaction.transaction_id}
                  transaction={transaction}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Last 10 Days */}
      <div>
        <h2 className="text-xl font-bold mb-4">Last 10 Days</h2>
        <div className="space-y-4">
          {Object.entries(groupedTransactions)
            .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
            .map(([date, txs]) => (
              <Card key={date}>
                <div className="p-4 border-b">
                  <h3 className="font-semibold">{format(new Date(date), "EEEE, MMMM dd, yyyy")}</h3>
                </div>
                <div className="divide-y">
                  {txs.map((transaction) => (
                    <TransactionRow
                      key={transaction.transaction_id}
                      transaction={transaction}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </Card>
            ))}
        </div>
      </div>

      {/* Edit Dialog */}
      <EditTransactionDialog
        open={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingTransaction(null);
        }}
        transaction={editingTransaction}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTransaction} onOpenChange={() => setDeleteTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const TransactionRow = ({
  transaction,
  onEdit,
  onDelete,
}: {
  transaction: any;
  onEdit: (t: any) => void;
  onDelete: (id: string) => void;
}) => {
  return (
    <motion.div
      whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
      className="p-4 flex items-center justify-between"
    >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg",
                          transaction.transaction_type === "income"
                            ? "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400"
                            : "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400"
                        )}
                      >
                        {transaction.transaction_type === "income" ? "+" : "-"}
                      </div>
                      <div>
                        <div className="font-semibold">{transaction.category || "Uncategorized"}</div>
                        <div className="text-sm text-muted-foreground">
                          {transaction.transaction_time ? transaction.transaction_time.slice(0, 5) : "N/A"} • {transaction.description || "No description"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "font-bold text-lg",
                          transaction.transaction_type === "income"
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {transaction.transaction_type === "income" ? "+" : "-"}₹{Number(transaction.amount).toLocaleString("en-IN")}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => onEdit(transaction)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(transaction.transaction_id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
    </motion.div>
  );
};

const EditTransactionDialog = ({
  open,
  onClose,
  transaction,
}: {
  open: boolean;
  onClose: () => void;
  transaction: any;
}) => {
  const [formData, setFormData] = useState({
    amount: transaction?.amount?.toString() || "",
    transaction_type: transaction?.transaction_type || "expense",
    transaction_date: transaction?.transaction_date ? new Date(transaction.transaction_date) : new Date(),
    transaction_time: transaction?.transaction_time ? transaction.transaction_time.slice(0, 5) : "",
    category: transaction?.category || "",
    subcategory: transaction?.subcategory || "",
    payment_method: transaction?.payment_method || "",
    description: transaction?.description || "",
    merchant_name: transaction?.merchant_name || "",
    location: transaction?.location || "",
    source: transaction?.source || "",
    is_recurring: transaction?.is_recurring || false,
    recurring_frequency: transaction?.recurring_frequency || "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (transaction) {
      setFormData({
        amount: transaction.amount?.toString() || "",
        transaction_type: transaction.transaction_type || "expense",
        transaction_date: transaction.transaction_date ? new Date(transaction.transaction_date) : new Date(),
        transaction_time: transaction.transaction_time ? transaction.transaction_time.slice(0, 5) : "",
        category: transaction.category || "",
        subcategory: transaction.subcategory || "",
        payment_method: transaction.payment_method || "",
        description: transaction.description || "",
        merchant_name: transaction.merchant_name || "",
        location: transaction.location || "",
        source: transaction.source || "",
        is_recurring: transaction.is_recurring || false,
        recurring_frequency: transaction.recurring_frequency || "",
      });
    }
  }, [transaction]);

  const handleSave = async () => {
    if (!transaction) return;
    try {
      setIsSaving(true);
      await db.transactions.update(transaction.transaction_id, {
        amount: parseFloat(formData.amount),
        transaction_type: formData.transaction_type,
        transaction_date: format(formData.transaction_date, "yyyy-MM-dd"),
        transaction_time: formData.transaction_time,
        category: formData.category,
        subcategory: formData.subcategory || undefined,
        description: formData.description || undefined,
        payment_method: formData.payment_method || undefined,
        merchant_name: formData.merchant_name || undefined,
        location: formData.location || undefined,
        source: formData.source || undefined,
        is_recurring: formData.is_recurring,
        recurring_frequency: formData.recurring_frequency || undefined,
      });
      toast.success("Transaction updated successfully!");
      onClose();
      window.location.reload(); // Refresh to show updated data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update transaction");
    } finally {
      setIsSaving(false);
    }
  };

  const categories = {
    income: ["Delivery", "Freelance", "Salary", "Other"],
    expense: ["Food", "Fuel", "Rent", "Groceries", "Maintenance", "Phone", "EMI", "Misc"],
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={formData.transaction_type}
                onValueChange={(v) => setFormData({ ...formData, transaction_type: v as any, category: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.transaction_date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.transaction_date}
                    onSelect={(date) => date && setFormData({ ...formData, transaction_date: date })}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={formData.transaction_time}
                onChange={(e) => setFormData({ ...formData, transaction_time: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories[formData.transaction_type].map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {["UPI", "Cash", "Card", "Bank Transfer"].map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="flex-1">
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Transactions;

