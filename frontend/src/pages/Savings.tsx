import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, PiggyBank, TrendingUp, Home, Shield, Wallet, LineChart } from "lucide-react";
import { motion } from "framer-motion";
import db, { getLocal, DEFAULT_SAVINGS_GOALS } from "@/services/database";
import { toast } from "sonner";
import PageIntro from "@/components/PageIntro";
import { hasMinimumTransactions, hasMinimumTransactionsSync } from "@/lib/dataRequirements";
import MinimumDataRequired from "@/components/MinimumDataRequired";

const Savings = () => {
  const navigate = useNavigate();
  const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') || 'usr-demo-101' : 'usr-demo-101';
  const initialGoals = getLocal<any[]>(`arthasetu_goals_${userId}`, DEFAULT_SAVINGS_GOALS);
  const [savingsGoals, setSavingsGoals] = useState<any[]>(initialGoals);
  const [investments, setInvestments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMinimumData, setHasMinimumData] = useState(() => hasMinimumTransactionsSync());
  const [activeTab, setActiveTab] = useState("savings");
  const [startingInvestmentId, setStartingInvestmentId] = useState<string | null>(null);

  useEffect(() => {
    checkDataRequirements();
  }, []);

  useEffect(() => {
    if (hasMinimumData) {
      loadData();
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

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [savingsData, investmentsData] = await Promise.all([
        db.savingsGoals.getAll(),
        db.investments.getAll(),
      ]);
      setSavingsGoals(savingsData);
      setInvestments(investmentsData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load savings data");
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case "low":
        return <Badge className="bg-green-100 text-green-800">Low Risk</Badge>;
      case "moderate":
        return <Badge className="bg-yellow-100 text-yellow-800">Moderate Risk</Badge>;
      case "high":
        return <Badge className="bg-red-100 text-red-800">High Risk</Badge>;
      default:
        return <Badge variant="outline">{riskLevel}</Badge>;
    }
  };

  const handleStartInvesting = async (investment: any) => {
    try {
      setStartingInvestmentId(investment.id);
      await db.actions.create({
        action_type: "investment",
        action_description: `Start ${investment.investment_type?.replace("_", " ")} with ${investment.provider || "recommended provider"}`,
        amount: investment.recommended_amount || 0,
        schedule: investment.frequency === "monthly" ? "monthly" : "once",
        status: "pending",
      });
      toast.success("Added to your Action Plan — approve it there to track progress");
      navigate("/actions");
    } catch (error) {
      console.error("Failed to start investment:", error);
      toast.error("Failed to add investment action");
    } finally {
      setStartingInvestmentId(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-l-red-500";
      case "medium":
        return "border-l-yellow-500";
      case "low":
        return "border-l-green-500";
      default:
        return "border-l-gray-500";
    }
  };

  // Calculate totals
  const totalSavingsTarget = savingsGoals.reduce((sum, g) => sum + (g.target_amount || 0), 0);
  const totalSaved = savingsGoals.reduce((sum, g) => sum + (g.current_amount || 0), 0);
  const totalMonthlyContribution = savingsGoals.reduce((sum, g) => sum + (g.monthly_contribution || 0), 0);
  const totalInvestmentRecommended = investments.reduce((sum, i) => sum + (i.recommended_amount || 0), 0);

  if (isLoading && savingsGoals.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading savings data...</p>
        </div>
      </div>
    );
  }

  if (!hasMinimumData) {
    return (
      <div className="space-y-6">
        <PageIntro
          title="Savings & Investments"
          description="Plan your savings and get personalized investment recommendations"
        />
        <MinimumDataRequired featureName="Savings & Investments" />
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
              <PiggyBank className="w-8 h-8 text-primary" />
              Savings & Investments
            </h1>
            <p className="text-muted-foreground">Build wealth with AI-powered recommendations</p>
          </div>
        </div>
      </div>

      <PageIntro
        title="What is this page?"
        description="This page shows your savings goals and investment recommendations. Our AI analyzes your income patterns to suggest the best savings strategies for gig workers."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-green-600" />
            <span className="text-sm text-muted-foreground">Total Saved</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            ₹{totalSaved.toLocaleString("en-IN")}
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-muted-foreground">Target</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            ₹{totalSavingsTarget.toLocaleString("en-IN")}
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank className="w-5 h-5 text-purple-600" />
            <span className="text-sm text-muted-foreground">Monthly Savings</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">
            ₹{totalMonthlyContribution.toLocaleString("en-IN")}
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-orange-600" />
            <span className="text-sm text-muted-foreground">Invest Monthly</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">
            ₹{totalInvestmentRecommended.toLocaleString("en-IN")}
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="savings">
            <PiggyBank className="w-4 h-4 mr-2" />
            Savings Goals
          </TabsTrigger>
          <TabsTrigger value="investments">
            <LineChart className="w-4 h-4 mr-2" />
            Investment Recommendations
          </TabsTrigger>
        </TabsList>

        {/* Savings Goals Tab */}
        <TabsContent value="savings" className="space-y-4">
          {savingsGoals.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-6xl mb-4">🐷</div>
              <h3 className="text-lg font-semibold mb-2">No savings goals yet</h3>
              <p className="text-muted-foreground mb-4">
                Run the AI analysis to get personalized savings recommendations based on your income patterns.
              </p>
            </Card>
          ) : (
            savingsGoals.map((goal, index) => (
              <motion.div
                key={goal.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={`p-6 border-l-4 ${getPriorityColor(goal.priority)}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{goal.goal_name}</h3>
                        <Badge variant="outline">{goal.goal_type}</Badge>
                        <Badge className={
                          goal.status === "completed" ? "bg-green-100 text-green-800" :
                          goal.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                          "bg-gray-100 text-gray-800"
                        }>
                          {goal.status?.replace("_", " ")}
                        </Badge>
                      </div>
                      {goal.reasoning && (
                        <p className="text-sm text-muted-foreground">{goal.reasoning}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {totalSavingsTarget > 0 ? Math.round((goal.current_amount / goal.target_amount) * 100) : 0}%
                      </div>
                      <div className="text-xs text-muted-foreground">Progress</div>
                    </div>
                  </div>

                  <Progress
                    value={goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0}
                    className="mb-4"
                  />

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Current</div>
                      <div className="font-semibold text-green-600">
                        ₹{(goal.current_amount || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Target</div>
                      <div className="font-semibold">
                        ₹{(goal.target_amount || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Monthly</div>
                      <div className="font-semibold text-blue-600">
                        ₹{(goal.monthly_contribution || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </TabsContent>

        {/* Investments Tab */}
        <TabsContent value="investments" className="space-y-4">
          {investments.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-6xl mb-4">📈</div>
              <h3 className="text-lg font-semibold mb-2">No investment recommendations yet</h3>
              <p className="text-muted-foreground mb-4">
                Run the AI analysis to get personalized investment suggestions tailored to your risk tolerance.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {investments.map((investment, index) => (
                <motion.div
                  key={investment.id || index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-6 h-full">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg capitalize">
                          {investment.investment_type?.replace("_", " ")}
                        </h3>
                        <p className="text-sm text-muted-foreground">{investment.provider}</p>
                      </div>
                      {getRiskBadge(investment.risk_level)}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Recommended Amount</span>
                        <span className="font-semibold text-primary">
                          ₹{(investment.recommended_amount || 0).toLocaleString("en-IN")}/{investment.frequency}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Expected Return</span>
                        <span className="font-semibold text-green-600">
                          {investment.expected_return}% p.a.
                        </span>
                      </div>
                    </div>

                    {investment.reasoning && (
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <p className="text-sm">💡 {investment.reasoning}</p>
                      </div>
                    )}

                    <Button
                      className="w-full mt-4"
                      variant="outline"
                      disabled={startingInvestmentId === investment.id}
                      onClick={() => handleStartInvesting(investment)}
                    >
                      {startingInvestmentId === investment.id ? "Adding..." : "Start Investing"}
                    </Button>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {/* Investment Tips */}
          <Card className="p-6 bg-gradient-to-r from-primary/10 to-secondary/10">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              💡 Investment Tips for Gig Workers
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Start SIP on your highest earning day of the month to ensure funds are available</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Keep 2-3 months expenses in liquid funds for emergencies</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Use PPF or NPS for tax-saving investments (Section 80C)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Prefer low-cost index funds over actively managed funds for long-term</span>
              </li>
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Savings;
