import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, Clock, Play, Pause, RotateCcw, Home, Receipt, Plus } from "lucide-react";
import { motion } from "framer-motion";
import db from "@/services/database";
import { toast } from "sonner";
import { format } from "date-fns";
import PageIntro from "@/components/PageIntro";
import HelpTooltip from "@/components/HelpTooltip";
import { hasMinimumTransactions, hasMinimumTransactionsSync } from "@/lib/dataRequirements";
import MinimumDataRequired from "@/components/MinimumDataRequired";
import db, { getLocal, DEFAULT_ACTIONS, DEFAULT_BILLS } from "@/services/database";

const Actions = () => {
  const navigate = useNavigate();
  const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') || 'usr-demo-101' : 'usr-demo-101';
  const initialActions = getLocal<any[]>(`arthasetu_actions_${userId}`, DEFAULT_ACTIONS);
  const initialBills = getLocal<any[]>(`arthasetu_bills_${userId}`, DEFAULT_BILLS);
  const [actions, setActions] = useState<any[]>(initialActions);
  const [bills, setBills] = useState<any[]>(initialBills);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMinimumData, setHasMinimumData] = useState(() => hasMinimumTransactionsSync());
  const [filter, setFilter] = useState<"today" | "upcoming" | "ongoing" | "completed" | "bills">("today");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBillCreateOpen, setIsBillCreateOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    plan_name: "",
    description: "",
    type: "",
    target_amount: "",
    target_date: "",
    frequency: "once",
  });
  const [billFormData, setBillFormData] = useState({
    bill_name: "",
    bill_type: "",
    amount: "",
    due_date: "",
    frequency: "monthly",
    auto_pay: false,
  });

  useEffect(() => {
    checkDataRequirements();
  }, []);

  useEffect(() => {
    if (hasMinimumData) {
      if (filter === "bills") {
        loadBills();
      } else {
        loadActions();
      }
    }
  }, [filter, hasMinimumData]);

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

  const loadActions = async () => {
    try {
      setIsLoading(true);
      const data = await db.actions.getAll({ date_range: filter as "today" | "upcoming" | "ongoing" | "completed" });
      setActions(data);
    } catch (error) {
      console.error("Failed to load actions:", error);
      toast.error("Failed to load actions");
    } finally {
      setIsLoading(false);
    }
  };

  const loadBills = async () => {
    try {
      setIsLoading(true);
      const data = await db.bills.getAll();
      setBills(data);
    } catch (error) {
      console.error("Failed to load bills:", error);
      toast.error("Failed to load bills");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkBillPaid = async (billId: string) => {
    try {
      await db.bills.markPaid(billId);
      toast.success("Bill marked as paid!");
      loadBills();
    } catch (error) {
      console.error("Failed to mark bill as paid:", error);
      toast.error("Failed to update bill");
    }
  };

  const handleCreateBill = async () => {
    try {
      if (!billFormData.bill_name || !billFormData.bill_type || !billFormData.amount || !billFormData.due_date) {
        toast.error("Please fill in all required fields");
        return;
      }

      await db.bills.create({
        bill_name: billFormData.bill_name,
        bill_type: billFormData.bill_type,
        amount: parseFloat(billFormData.amount),
        due_date: billFormData.due_date,
        frequency: billFormData.frequency,
        auto_pay_recommended: billFormData.auto_pay,
      });

      toast.success("Bill added successfully!");
      setIsBillCreateOpen(false);
      setBillFormData({
        bill_name: "",
        bill_type: "",
        amount: "",
        due_date: "",
        frequency: "monthly",
        auto_pay: false,
      });
      loadBills();
    } catch (error) {
      console.error("Failed to create bill:", error);
      toast.error("Failed to add bill");
    }
  };

  const handleApprove = async (actionId: string) => {
    try {
      await db.actions.updateStatus(actionId, {
        status: "active",
        user_approved: true,
        approval_date: new Date().toISOString(),
      });
      toast.success("Action approved");
      loadActions();
    } catch (error) {
      console.error("Failed to approve action:", error);
      toast.error("Failed to approve action");
    }
  };

  const handlePause = async (actionId: string) => {
    try {
      await db.actions.updateStatus(actionId, { status: "paused" });
      toast.success("Action paused");
      loadActions();
    } catch (error) {
      console.error("Failed to pause action:", error);
      toast.error("Failed to pause action");
    }
  };

  const handleRequestReversal = async (actionId: string) => {
    try {
      await db.actions.updateStatus(actionId, {
        reversal_requested: true,
        reversal_date: new Date().toISOString(),
      });
      toast.success("Reversal requested");
      loadActions();
    } catch (error) {
      console.error("Failed to request reversal:", error);
      toast.error("Failed to request reversal");
    }
  };

  const handleCreateAction = async () => {
    try {
      if (!createFormData.plan_name || !createFormData.type || !createFormData.target_amount) {
        toast.error("Please fill in all required fields");
        return;
      }

      await db.actions.create({
        action_type: createFormData.type,
        action_description: createFormData.plan_name + (createFormData.description ? `: ${createFormData.description}` : ''),
        amount: parseFloat(createFormData.target_amount),
        target_date: createFormData.target_date || undefined,
        schedule: createFormData.frequency,
        status: 'pending',
      });

      toast.success("Action plan created successfully!");
      setIsCreateOpen(false);
      setCreateFormData({
        plan_name: "",
        description: "",
        type: "",
        target_amount: "",
        target_date: "",
        frequency: "once",
      });
      loadActions();
    } catch (error) {
      console.error("Failed to create action:", error);
      toast.error("Failed to create action plan");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "active":
        return <Badge className="bg-blue-100 text-blue-800">Active</Badge>;
      case "paused":
        return <Badge className="bg-yellow-100 text-yellow-800">Paused</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  if (isLoading && actions.length === 0 && bills.length === 0) {
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
          title="Action Plans"
          description="Track and execute your financial action plans"
        />
        <MinimumDataRequired featureName="Action Plans" />
      </div>
    );
  }

  const todayActions = actions.filter((a) => {
    // Include actions without next_execution (newly created pending)
    if (!a.next_execution) {
      return a.status === "pending" || a.status === "active";
    }
    const nextDate = new Date(a.next_execution);
    const today = new Date();
    return nextDate.toDateString() === today.toDateString();
  });

  const upcomingActions = actions.filter((a) => {
    if (!a.next_execution) return false;
    const nextDate = new Date(a.next_execution);
    const today = new Date();
    return nextDate > today && nextDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  });

  const completedActions = actions.filter((a) => a.status === "completed");

  const ongoingActions = actions.filter((a) =>
    a.status === "active" && a.schedule && a.schedule !== "once"
  );

  return (
    <div className="space-y-6">
        {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")} title="Back to Home">
            <Home className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Action Plan</h1>
            <p className="text-muted-foreground">Manage your financial actions</p>
          </div>
              </div>
            </div>

      <PageIntro
        title="What is this page?"
        description="This is your to-do list for money. It shows concrete actions like savings transfers or repayments and tracks their progress."
      />

      <div className="flex items-center justify-end mb-4">
        <Button onClick={() => setIsCreateOpen(true)}>
          Create Custom Action
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <Button
          variant={filter === "today" ? "default" : "outline"}
          onClick={() => setFilter("today")}
        >
          Today
        </Button>
        <Button
          variant={filter === "upcoming" ? "default" : "outline"}
          onClick={() => setFilter("upcoming")}
        >
          Upcoming
        </Button>
        <Button
          variant={filter === "ongoing" ? "default" : "outline"}
          onClick={() => setFilter("ongoing")}
        >
          Ongoing
        </Button>
        <Button
          variant={filter === "completed" ? "default" : "outline"}
          onClick={() => setFilter("completed")}
        >
          Completed
        </Button>
        <Button
          variant={filter === "bills" ? "default" : "outline"}
          onClick={() => setFilter("bills")}
        >
          <Receipt className="w-4 h-4 mr-2" />
          Bills
        </Button>
              </div>

      {/* Today & Upcoming Actions */}
      {(filter === "today" || filter === "upcoming") && (() => {
        const currentActions = filter === "today" ? todayActions : upcomingActions;
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">
              {filter === "today" ? "Today's Actions" : "Upcoming Actions"}
            </h2>
            {currentActions.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No actions scheduled for this period</p>
            </Card>
            ) : (
              <div className="space-y-4">
                {currentActions.map((action) => (
                  <Card key={action.action_id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{action.action_description || action.action_type}</h3>
                          {getStatusBadge(action.status)}
                          {action.reversal_requested && <Badge variant="outline">Reversal requested</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Amount: ₹{Number(action.amount || 0).toLocaleString("en-IN")}
                        </p>
                        {action.next_execution && (
                          <p className="text-sm text-muted-foreground">
                            Next execution: {format(new Date(action.next_execution), "PPP")}
                          </p>
                        )}
                        {action.schedule && (
                          <p className="text-sm text-muted-foreground">Schedule: {action.schedule}</p>
                        )}
                      </div>
              </div>
                    <div className="flex gap-2">
                      {action.status === "active" ? (
                        <Button variant="outline" size="sm" onClick={() => handlePause(action.action_id)}>
                          <Pause className="w-4 h-4 mr-2" />
                          Pause
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => handleApprove(action.action_id)}>
                          <Play className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                      )}
                      {action.is_reversible && !action.reversal_requested && (
                        <Button variant="outline" size="sm" onClick={() => handleRequestReversal(action.action_id)}>
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Request Reversal
                        </Button>
                      )}
                      </div>
                  </Card>
                ))}
                    </div>
            )}
                  </div>
        );
      })()}

      {/* Ongoing Actions */}
      {filter === "ongoing" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Ongoing Recurring Actions</h2>
          {ongoingActions.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No ongoing recurring actions</p>
              <p className="text-sm text-muted-foreground mt-2">
                Create actions with daily, weekly, or monthly frequency to see them here
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {ongoingActions.map((action) => (
                <Card key={action.action_id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{action.action_description || action.action_type}</h3>
                        {getStatusBadge(action.status)}
                        <Badge variant="outline">{action.schedule}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Amount: ₹{Number(action.amount || 0).toLocaleString("en-IN")}
                      </p>
                      {action.next_execution && (
                        <p className="text-sm text-muted-foreground">
                          Next execution: {format(new Date(action.next_execution), "PPP")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handlePause(action.action_id)}>
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Completed Actions */}
      {filter === "completed" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Completed Actions & Outcomes</h2>
          {completedActions.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No completed actions yet</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {completedActions.map((action) => (
                <Card key={action.action_id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <h3 className="font-semibold">{action.action_description || action.action_type}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Completed on: {action.execution_date ? format(new Date(action.execution_date), "PPP") : "N/A"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Amount: ₹{Number(action.amount || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    </div>
                </Card>
              ))}
                      </div>
                    )}
                  </div>
      )}

      {/* Bills Section */}
      {filter === "bills" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Bills & Payments</h2>
            <Button onClick={() => setIsBillCreateOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Bill
            </Button>
          </div>
          {bills.length === 0 ? (
            <Card className="p-12 text-center">
              <Receipt className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No bills added yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Add your recurring bills to track due dates and payments
              </p>
              <Button className="mt-4" onClick={() => setIsBillCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Bill
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {bills.map((bill) => {
                const dueDate = new Date(bill.due_date);
                const today = new Date();
                const isOverdue = dueDate < today && bill.status !== "paid";
                const isDueSoon = !isOverdue && dueDate <= new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

                return (
                  <Card key={bill.id} className={`p-6 ${isOverdue ? "border-red-300 bg-red-50 dark:bg-red-950/20" : isDueSoon ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20" : ""}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Receipt className="w-5 h-5 text-muted-foreground" />
                          <h3 className="font-semibold text-lg">{bill.bill_name}</h3>
                          <Badge variant="outline">{bill.bill_type}</Badge>
                          {bill.status === "paid" ? (
                            <Badge className="bg-green-100 text-green-800">Paid</Badge>
                          ) : isOverdue ? (
                            <Badge className="bg-red-100 text-red-800">Overdue</Badge>
                          ) : isDueSoon ? (
                            <Badge className="bg-yellow-100 text-yellow-800">Due Soon</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Amount: <span className="font-semibold text-foreground">₹{Number(bill.amount || 0).toLocaleString("en-IN")}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Due: {format(dueDate, "PPP")} • {bill.frequency}
                        </p>
                      </div>
                    </div>
                    {bill.status !== "paid" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleMarkBillPaid(bill.id)}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark as Paid
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Custom Action Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Custom Action Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plan Name *</Label>
              <Input 
                placeholder="e.g., Emergency Fund Goal" 
                value={createFormData.plan_name}
                onChange={(e) => setCreateFormData({ ...createFormData, plan_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                placeholder="Describe your action plan..." 
                rows={3}
                value={createFormData.description}
                onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select 
                  value={createFormData.type}
                  onValueChange={(v) => setCreateFormData({ ...createFormData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="debt">Debt</SelectItem>
                    <SelectItem value="budget">Budget</SelectItem>
                    <SelectItem value="risk">Risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Amount *</Label>
                <Input 
                  type="number" 
                  placeholder="0" 
                  value={createFormData.target_amount}
                  onChange={(e) => setCreateFormData({ ...createFormData, target_amount: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Date</Label>
                <Input 
                  type="date" 
                  value={createFormData.target_date}
                  onChange={(e) => setCreateFormData({ ...createFormData, target_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select 
                  value={createFormData.frequency}
                  onValueChange={(v) => setCreateFormData({ ...createFormData, frequency: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">One-time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsCreateOpen(false);
                  setCreateFormData({
                    plan_name: "",
                    description: "",
                    type: "",
                    target_amount: "",
                    target_date: "",
                    frequency: "once",
                  });
                }} 
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleCreateAction} className="flex-1" disabled={!createFormData.plan_name || !createFormData.type || !createFormData.target_amount}>
                Save Plan
        </Button>
      </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Bill Dialog */}
      <Dialog open={isBillCreateOpen} onOpenChange={setIsBillCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Bill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Bill Name *</Label>
              <Input
                placeholder="e.g., Electricity Bill, Rent"
                value={billFormData.bill_name}
                onChange={(e) => setBillFormData({ ...billFormData, bill_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bill Type *</Label>
                <Select
                  value={billFormData.bill_type}
                  onValueChange={(v) => setBillFormData({ ...billFormData, bill_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electricity">Electricity</SelectItem>
                    <SelectItem value="water">Water</SelectItem>
                    <SelectItem value="gas">Gas</SelectItem>
                    <SelectItem value="internet">Internet</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="rent">Rent</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="loan">Loan EMI</SelectItem>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={billFormData.amount}
                  onChange={(e) => setBillFormData({ ...billFormData, amount: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  value={billFormData.due_date}
                  onChange={(e) => setBillFormData({ ...billFormData, due_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={billFormData.frequency}
                  onValueChange={(v) => setBillFormData({ ...billFormData, frequency: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">One-time</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsBillCreateOpen(false);
                  setBillFormData({
                    bill_name: "",
                    bill_type: "",
                    amount: "",
                    due_date: "",
                    frequency: "monthly",
                    auto_pay: false,
                  });
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateBill}
                className="flex-1"
                disabled={!billFormData.bill_name || !billFormData.bill_type || !billFormData.amount || !billFormData.due_date}
              >
                Add Bill
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Actions;
