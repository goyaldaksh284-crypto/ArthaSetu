import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Shield, CheckCircle, Home } from "lucide-react";
import { motion } from "framer-motion";
import db from "@/services/database";
import { toast } from "sonner";
import PageIntro from "@/components/PageIntro";
import HelpTooltip from "@/components/HelpTooltip";
import { hasMinimumTransactions, hasMinimumTransactionsSync } from "@/lib/dataRequirements";
import MinimumDataRequired from "@/components/MinimumDataRequired";

const RiskDashboard = () => {
  const navigate = useNavigate();
  const [risk, setRisk] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMinimumData, setHasMinimumData] = useState(() => hasMinimumTransactionsSync());
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    checkDataRequirements();
  }, []);

  useEffect(() => {
    if (hasMinimumData) {
      loadRiskAssessment();
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

  const loadRiskAssessment = async () => {
    try {
      setIsLoading(true);
      setLoadError(false);
      // getLatest() resolves to null (not an error) when no assessment has
      // been generated yet -- that's a real, expected state, not a failure.
      const data = await db.riskAssessments.getLatest();
      setRisk(data);
    } catch (error) {
      console.error("Failed to load risk assessment:", error);
      setRisk(null);
      setLoadError(true);
      toast.error("Failed to load risk assessment");
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "low":
        return "bg-green-100 text-green-800 border-green-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "high":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level?.toLowerCase()) {
      case "low":
        return <Shield className="w-6 h-6" />;
      case "medium":
        return <AlertTriangle className="w-6 h-6" />;
      case "high":
        return <AlertTriangle className="w-6 h-6" />;
      default:
        return <AlertTriangle className="w-6 h-6" />;
    }
  };

  if (isLoading && !risk) {
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
          title="Risk Dashboard"
          description="Analyze and understand your financial risks"
        />
        <MinimumDataRequired featureName="Risk Analysis" />
      </div>
    );
  }

  if (!risk) {
    return (
      <Card className="p-12 text-center">
        <p className="text-lg font-semibold mb-2">
          {loadError ? "Couldn't load your risk assessment" : "No risk assessment available"}
        </p>
        <p className="text-muted-foreground mb-4">
          {loadError
            ? "Something went wrong fetching your data. Please try again."
            : "Risk assessment will be generated based on your financial data"}
        </p>
        {loadError && (
          <Button onClick={loadRiskAssessment} variant="outline">
            Try Again
          </Button>
        )}
      </Card>
    );
  }

  const riskFactors = risk.risk_factors || [];
  const recommendedActions = risk.recommended_actions || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")} title="Back to Home">
            <Home className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Risk Analysis</h1>
            <p className="text-muted-foreground">Financial health assessment</p>
          </div>
        </div>
        <Button onClick={loadRiskAssessment} variant="outline">
          🔄 Refresh
        </Button>
      </div>

      <PageIntro
        title="What is this page?"
        description="This page shows how risky your current money situation is, and why: low savings, high EMIs, income drops, and other stress points."
      />

      {/* Risk Score Card */}
      <Card className="p-6">
        <div className="flex items-center gap-6">
          <div className={`p-4 rounded-lg ${getRiskColor(risk.overall_risk_level)}`}>
            {getRiskIcon(risk.overall_risk_level)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-sm text-muted-foreground">Overall Risk Level</p>
              <HelpTooltip text="Quick summary of how fragile or safe your money situation is right now." />
            </div>
            <p className="text-3xl font-bold capitalize">{risk.overall_risk_level || "Medium"}</p>
            <p className="text-sm text-muted-foreground mt-1">Risk Score: {risk.risk_score?.toFixed(1) || "N/A"}/10</p>
          </div>
        </div>
      </Card>

      {/* Risk Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-1.5 mb-2">
            <p className="text-sm text-muted-foreground">Debt-to-Income Ratio</p>
            <HelpTooltip text="Part of your income that goes into EMIs and loan payments." />
          </div>
          <p className="text-2xl font-bold">
            {risk.debt_to_income_ratio != null ? (risk.debt_to_income_ratio * 100).toFixed(1) : "N/A"}%
          </p>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-1.5 mb-2">
            <p className="text-sm text-muted-foreground">Income Drop %</p>
            <HelpTooltip text="How much your income has fallen compared to previous periods." />
          </div>
          <p className="text-2xl font-bold">
            {risk.income_drop_percentage ? risk.income_drop_percentage.toFixed(1) : "0"}%
          </p>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-1.5 mb-2">
            <p className="text-sm text-muted-foreground">Expense Spike Factor</p>
            <HelpTooltip text="How much your spending increased compared to your usual level." />
          </div>
          <p className="text-2xl font-bold">
            {risk.expense_spike_factor ? risk.expense_spike_factor.toFixed(2) : "1.0"}x
          </p>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-1.5 mb-2">
            <p className="text-sm text-muted-foreground">Emergency Fund Coverage</p>
            <HelpTooltip text="How many months you can survive using your savings if income stops." />
          </div>
          <p className="text-2xl font-bold">
            {risk.emergency_fund_coverage ? risk.emergency_fund_coverage.toFixed(1) : "N/A"} months
          </p>
        </Card>
      </div>

      {/* Risk Factors */}
      {riskFactors.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Risk Factors</h3>
          <div className="space-y-3">
            {riskFactors.map((factor: any, index: number) => {
              // Handle both string and object formats
              const factorName = typeof factor === 'string' 
                ? factor 
                : (factor?.name || factor?.factor || factor?.detail || JSON.stringify(factor));
              const factorDetail = typeof factor === 'object' 
                ? (factor?.detail || factor?.impact || factor?.description) 
                : null;
              const severity = typeof factor === 'object' ? factor?.severity : null;
              
              return (
                <div key={index} className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{factorName}</p>
                        {severity && (
                          <Badge variant="outline" className="text-xs">
                            {severity}
                          </Badge>
                        )}
                      </div>
                      {factorDetail && (
                        <p className="text-sm text-muted-foreground mt-1">{factorDetail}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recommended Actions */}
      {recommendedActions.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recommended Actions</h3>
          <div className="space-y-3">
            {recommendedActions.map((action: any, index: number) => (
              <div key={index} className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">{typeof action === "string" ? action : action.action || action.title}</p>
                    {typeof action === "object" && action.description && (
                      <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Escalation Banner */}
      {risk.escalation_needed && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>High Risk Detected:</strong> {risk.escalation_reason || "Please review your financial situation and consider seeking professional advice."}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default RiskDashboard;
