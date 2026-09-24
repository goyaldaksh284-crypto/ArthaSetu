import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Target, Plus, Home, ChevronDown, ChevronUp, CheckCircle, Clock, AlertCircle, PiggyBank, IndianRupee } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import db from "@/services/database";
import { toast } from "sonner";
import { format } from "date-fns";
import PageIntro from "@/components/PageIntro";
import { hasMinimumTransactions, hasMinimumTransactionsSync } from "@/lib/dataRequirements";
import MinimumDataRequired from "@/components/MinimumDataRequired";
import db, { getLocal, DEFAULT_SAVINGS_GOALS } from "@/services/database";

const Goals = () => {
  const navigate = useNavigate();
  const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') || 'usr-demo-101' : 'usr-demo-101';
  const initialGoals = getLocal<any[]>(`arthasetu_goals_${userId}`, DEFAULT_SAVINGS_GOALS);
  const [goals, setGoals] = useState<any[]>(initialGoals);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMinimumData, setHasMinimumData] = useState(() => hasMinimumTransactionsSync());
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const [createFormData, setCreateFormData] = useState({
    goal_name: "",
    goal_type: "",
    description: "",
    target_amount: "",
    target_date: "",
    monthly_target: "",
  });

  useEffect(() => {
    checkDataRequirements();
  }, []);

  useEffect(() => {
    if (hasMinimumData) {
      loadGoals();
    }
  }, [hasMinimumData]);

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

  const loadGoals = async () => {
    try {
      const data = await db.financialGoals.getAll();
      if (data && data.length > 0) {
        setGoals(data);
      }
    } catch (error) {
      console.error("Failed to load goals:", error);
      toast.error("Failed to load goals");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGoal = async () => {
    try {
      if (!createFormData.goal_name || !createFormData.goal_type || !createFormData.target_amount) {
        toast.error("Please fill in all required fields");
        return;
      }

      await db.financialGoals.create({
        goal_name: createFormData.goal_name,
        goal_type: createFormData.goal_type,
        description: createFormData.description,
        target_amount: parseFloat(createFormData.target_amount),
        target_date: createFormData.target_date || undefined,
        monthly_target: createFormData.monthly_target ? parseFloat(createFormData.monthly_target) : undefined,
      });

      toast.success("Goal created successfully!");
      setIsCreateOpen(false);
      setCreateFormData({
        goal_name: "",
        goal_type: "",
        description: "",
        target_amount: "",
        target_date: "",
        monthly_target: "",
      });
      loadGoals();
    } catch (error) {
      console.error("Failed to create goal:", error);
      toast.error("Failed to create goal");
    }
  };

  const openContributeDialog = (goal: any) => {
    setSelectedGoal(goal);
    setContributionAmount("");
    setIsContributeOpen(true);
  };

  const handleContribute = async () => {
    try {
      if (!selectedGoal || !contributionAmount) {
        toast.error("Please enter an amount");
        return;
      }

      const amount = parseFloat(contributionAmount);
      if (amount <= 0) {
        toast.error("Please enter a valid amount");
        return;
      }

      const newCurrentAmount = (selectedGoal.current_amount || 0) + amount;
      const newProgress = Math.min(100, (newCurrentAmount / selectedGoal.target_amount) * 100);
      const newStatus = newProgress >= 100 ? "completed" : "in_progress";

      await db.financialGoals.updateProgress(selectedGoal.id, {
        current_amount: newCurrentAmount,
        progress_percentage: newProgress,
        status: newStatus,
      });

      toast.success(`Added ₹${amount.toLocaleString("en-IN")} to ${selectedGoal.goal_name}!`);

      if (newProgress >= 100) {
        toast.success("Congratulations! You've completed this goal!", { duration: 5000 });
      }

      setIsContributeOpen(false);
      setSelectedGoal(null);
      setContributionAmount("");
      loadGoals();
    } catch (error) {
      console.error("Failed to add contribution:", error);
      toast.error("Failed to add contribution");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>;
      case "paused":
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="w-3 h-3 mr-1" />Paused</Badge>;
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  const getGoalTypeIcon = (type: string) => {
    switch (type) {
      case "emergency_fund":
        return "🛡️";
      case "asset_purchase":
        return "🏍️";
      case "education":
        return "📚";
      case "healthcare":
        return "🏥";
      case "retirement":
        return "👴";
      case "lifestyle":
        return "🎉";
      case "business":
        return "💼";
      case "debt_repayment":
        return "💳";
      default:
        return "🎯";
    }
  };

  if (isLoading && goals.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading goals...</p>
        </div>
      </div>
    );
  }

  if (!hasMinimumData) {
    return (
      <div className="space-y-6">
        <PageIntro
          title="Financial Goals"
          description="Plan and track your financial goals with AI-powered guidance"
        />
        <MinimumDataRequired featureName="Financial Goals" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")} title="Back to Home">
            <Home className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Target className="w-8 h-8 text-primary" />
              Financial Goals
            </h1>
            <p className="text-muted-foreground">Track your progress toward financial freedom</p>
          </div>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Goal
        </Button>
      </div>

      <PageIntro
        title="What is this page?"
        description="This page helps you set and track financial goals. Each goal comes with AI-generated explanations, milestones, and actionable steps tailored to your income patterns."
      />

      {/* Goals Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
          <div className="text-sm text-muted-foreground">Active Goals</div>
          <div className="text-2xl font-bold text-green-600">
            {goals.filter(g => g.status === "in_progress").length}
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <div className="text-sm text-muted-foreground">Total Target</div>
          <div className="text-2xl font-bold text-blue-600">
            ₹{goals.reduce((sum, g) => sum + (g.target_amount || 0), 0).toLocaleString("en-IN")}
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
          <div className="text-sm text-muted-foreground">Total Saved</div>
          <div className="text-2xl font-bold text-purple-600">
            ₹{goals.reduce((sum, g) => sum + (g.current_amount || 0), 0).toLocaleString("en-IN")}
          </div>
        </Card>
      </div>

      {/* Goals List */}
      {goals.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-lg font-semibold mb-2">No goals yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first financial goal to start your journey toward financial freedom.
          </p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Goal
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="overflow-hidden">
                <div
                  className="p-6 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">{getGoalTypeIcon(goal.goal_type)}</div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{goal.goal_name}</h3>
                          {getStatusBadge(goal.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{goal.description}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span>
                            Target: <strong>₹{(goal.target_amount || 0).toLocaleString("en-IN")}</strong>
                          </span>
                          <span>
                            Saved: <strong className="text-green-600">₹{(goal.current_amount || 0).toLocaleString("en-IN")}</strong>
                          </span>
                          {goal.target_date && (
                            <span>
                              By: <strong>{format(new Date(goal.target_date), "MMM yyyy")}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); openContributeDialog(goal); }}
                        className="hidden md:flex"
                      >
                        <PiggyBank className="w-4 h-4 mr-2" />
                        Add Money
                      </Button>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          {Math.round(goal.progress_percentage || 0)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Progress</div>
                      </div>
                      {expandedGoal === goal.id ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <Progress value={goal.progress_percentage || 0} className="mt-4" />
                </div>

                <AnimatePresence>
                  {expandedGoal === goal.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t bg-muted/30"
                    >
                      <div className="p-6 space-y-6">
                        {/* Explanation Section */}
                        {goal.explanation && (
                          <div className="space-y-4">
                            <h4 className="font-semibold flex items-center gap-2">
                              💡 Why This Goal Matters
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {goal.explanation.why_important && (
                                <Card className="p-4 bg-blue-50 dark:bg-blue-900/20">
                                  <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Why Important</div>
                                  <p className="text-sm">{goal.explanation.why_important}</p>
                                </Card>
                              )}
                              {goal.explanation.how_calculated && (
                                <Card className="p-4 bg-green-50 dark:bg-green-900/20">
                                  <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">How Calculated</div>
                                  <p className="text-sm">{goal.explanation.how_calculated}</p>
                                </Card>
                              )}
                              {goal.explanation.how_to_achieve && (
                                <Card className="p-4 bg-purple-50 dark:bg-purple-900/20">
                                  <div className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">How to Achieve</div>
                                  <p className="text-sm">{goal.explanation.how_to_achieve}</p>
                                </Card>
                              )}
                              {goal.explanation.impact_if_achieved && (
                                <Card className="p-4 bg-orange-50 dark:bg-orange-900/20">
                                  <div className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">Impact</div>
                                  <p className="text-sm">{goal.explanation.impact_if_achieved}</p>
                                </Card>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Milestones */}
                        {goal.milestones && goal.milestones.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-semibold flex items-center gap-2">
                              🏆 Milestones
                            </h4>
                            <div className="space-y-2">
                              {goal.milestones.map((milestone: any, idx: number) => (
                                <div
                                  key={idx}
                                  className={`flex items-center justify-between p-3 rounded-lg ${
                                    milestone.status === "completed"
                                      ? "bg-green-50 dark:bg-green-900/20"
                                      : milestone.status === "in_progress"
                                      ? "bg-blue-50 dark:bg-blue-900/20"
                                      : "bg-muted"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    {milestone.status === "completed" ? (
                                      <CheckCircle className="w-5 h-5 text-green-600" />
                                    ) : milestone.status === "in_progress" ? (
                                      <Clock className="w-5 h-5 text-blue-600" />
                                    ) : (
                                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />
                                    )}
                                    <div>
                                      <div className="font-medium">{milestone.milestone_name}</div>
                                      <div className="text-sm text-muted-foreground">
                                        ₹{(milestone.target_amount || 0).toLocaleString("en-IN")}
                                        {milestone.target_date && ` by ${format(new Date(milestone.target_date), "MMM yyyy")}`}
                                      </div>
                                    </div>
                                  </div>
                                  {milestone.reward && (
                                    <div className="text-sm text-muted-foreground italic">
                                      🎁 {milestone.reward}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Steps */}
                        {goal.action_steps && goal.action_steps.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-semibold flex items-center gap-2">
                              ✅ Action Steps
                            </h4>
                            <ul className="space-y-2">
                              {goal.action_steps.map((step: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-primary font-bold">{idx + 1}.</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Monthly Target */}
                        {goal.monthly_target > 0 && (
                          <Card className="p-4 bg-primary/10">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm text-muted-foreground">Monthly Target</div>
                                <div className="text-xl font-bold">₹{goal.monthly_target.toLocaleString("en-IN")}</div>
                              </div>
                              <Button size="sm" onClick={(e) => { e.stopPropagation(); openContributeDialog(goal); }}>
                                <PiggyBank className="w-4 h-4 mr-2" />
                                Add Savings
                              </Button>
                            </div>
                          </Card>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Goal Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Financial Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Goal Name *</Label>
              <Input
                placeholder="e.g., Build Emergency Fund"
                value={createFormData.goal_name}
                onChange={(e) => setCreateFormData({ ...createFormData, goal_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Goal Type *</Label>
                <Select
                  value={createFormData.goal_type}
                  onValueChange={(v) => setCreateFormData({ ...createFormData, goal_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emergency_fund">🛡️ Emergency Fund</SelectItem>
                    <SelectItem value="asset_purchase">🏍️ Asset Purchase</SelectItem>
                    <SelectItem value="education">📚 Education</SelectItem>
                    <SelectItem value="healthcare">🏥 Healthcare</SelectItem>
                    <SelectItem value="retirement">👴 Retirement</SelectItem>
                    <SelectItem value="lifestyle">🎉 Lifestyle</SelectItem>
                    <SelectItem value="business">💼 Business</SelectItem>
                    <SelectItem value="debt_repayment">💳 Debt Repayment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Amount (₹) *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={createFormData.target_amount}
                  onChange={(e) => setCreateFormData({ ...createFormData, target_amount: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Why is this goal important to you?"
                rows={3}
                value={createFormData.description}
                onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
              />
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
                <Label>Monthly Savings Target (₹)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={createFormData.monthly_target}
                  onChange={(e) => setCreateFormData({ ...createFormData, monthly_target: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleCreateGoal}
                className="flex-1"
                disabled={!createFormData.goal_name || !createFormData.goal_type || !createFormData.target_amount}
              >
                Create Goal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contribute to Goal Dialog */}
      <Dialog open={isContributeOpen} onOpenChange={setIsContributeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-primary" />
              Add Money to Goal
            </DialogTitle>
          </DialogHeader>
          {selectedGoal && (
            <div className="space-y-6 py-4">
              {/* Goal Info */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-3xl">{getGoalTypeIcon(selectedGoal.goal_type)}</div>
                  <div>
                    <h3 className="font-semibold">{selectedGoal.goal_name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedGoal.goal_type?.replace("_", " ")}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Current</p>
                    <p className="font-semibold text-green-600">₹{(selectedGoal.current_amount || 0).toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Target</p>
                    <p className="font-semibold">₹{(selectedGoal.target_amount || 0).toLocaleString("en-IN")}</p>
                  </div>
                </div>
                <Progress value={selectedGoal.progress_percentage || 0} className="mt-3" />
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {Math.round(selectedGoal.progress_percentage || 0)}% complete
                </p>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label>Amount to Add (₹)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                    className="pl-10 text-lg"
                    autoFocus
                  />
                </div>
                {contributionAmount && parseFloat(contributionAmount) > 0 && (
                  <p className="text-sm text-green-600">
                    New balance: ₹{((selectedGoal.current_amount || 0) + parseFloat(contributionAmount)).toLocaleString("en-IN")}
                    {" "}({Math.min(100, Math.round(((selectedGoal.current_amount || 0) + parseFloat(contributionAmount)) / selectedGoal.target_amount * 100))}%)
                  </p>
                )}
              </div>

              {/* Quick Amount Buttons */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quick Add</Label>
                <div className="flex gap-2 flex-wrap">
                  {[500, 1000, 2000, 5000, 10000].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => setContributionAmount(String(amount))}
                    >
                      ₹{amount.toLocaleString("en-IN")}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsContributeOpen(false);
                    setSelectedGoal(null);
                    setContributionAmount("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleContribute}
                  className="flex-1"
                  disabled={!contributionAmount || parseFloat(contributionAmount) <= 0}
                >
                  <PiggyBank className="w-4 h-4 mr-2" />
                  Add ₹{contributionAmount ? parseFloat(contributionAmount).toLocaleString("en-IN") : "0"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Goals;
