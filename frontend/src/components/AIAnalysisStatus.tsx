import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Loader2, CheckCircle, AlertCircle, Play, RefreshCw } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { runFullAnalysis, type AgentProgress, type AnalysisSummary } from "@/services/aiAnalysis";
import { toast } from "sonner";

type RunStatus = "ready" | "in_progress" | "completed" | "failed";

export const AIAnalysisStatus = () => {
  const { user, refreshData } = useApp();
  const [status, setStatus] = useState<RunStatus>("ready");
  const [progress, setProgress] = useState<AgentProgress>({ completed: 0, total: 9, currentAgent: "" });
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);

  const triggerAnalysis = async () => {
    if (!user?.id) return;

    setStatus("in_progress");
    setSummary(null);
    setProgress({ completed: 0, total: 9, currentAgent: "Gathering your transactions..." });

    try {
      const result = await runFullAnalysis((p) => setProgress(p));
      setSummary(result);
      setStatus("completed");
      toast.success("AI analysis complete! Fresh recommendations are ready.");
      await refreshData();
    } catch (error) {
      console.error("AI analysis failed:", error);
      setStatus("failed");
      toast.error(error instanceof Error ? error.message : "AI analysis failed");
    }
  };

  if (!user) {
    return null;
  }

  const progressPct = status === "in_progress"
    ? (progress.completed / progress.total) * 100
    : status === "completed" ? 100 : 0;

  const getStatusIcon = () => {
    if (!status || status === "ready") return <Brain className="w-4 h-4" />;
    switch (status) {
      case "in_progress":
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "in_progress":
        return progress.currentAgent
          ? `Running: ${progress.currentAgent} (${progress.completed}/${progress.total})`
          : "AI Analysis in Progress";
      case "completed":
        return "AI Analysis Complete";
      case "failed":
        return "AI Analysis Failed";
      default:
        return "AI Analysis Ready";
    }
  };

  const getStatusColor = (): "secondary" | "default" | "destructive" => {
    switch (status) {
      case "in_progress":
      case "completed":
        return "default";
      case "failed":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getStatusIcon()}
          AI Financial Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant={getStatusColor()}>
            {getStatusText()}
          </Badge>
          <button
            onClick={triggerAnalysis}
            disabled={status === "in_progress"}
            className="px-3 py-1 text-sm bg-black text-white rounded hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-2"
          >
            {status === "in_progress" ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Running...
              </>
            ) : status === "completed" ? (
              <>
                <RefreshCw className="w-3 h-3" />
                Re-run Analysis
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Start Analysis
              </>
            )}
          </button>
        </div>

        {status === "in_progress" && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{progress.currentAgent || "Starting..."}</span>
              <span>{progress.completed}/{progress.total} agents</span>
            </div>
            <Progress value={progressPct} className="w-full" />
          </div>
        )}

        {status === "completed" && summary && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2 bg-muted rounded-lg">
                <p className="text-lg font-bold">{summary.healthScore}</p>
                <p className="text-xs text-muted-foreground">Health score</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <p className="text-lg font-bold">{summary.emergencyFundMonths > 99 ? "99+" : summary.emergencyFundMonths.toFixed(1)}mo</p>
                <p className="text-xs text-muted-foreground">Emergency fund</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <p className="text-lg font-bold">{Math.round(summary.volatilityIndex * 100)}%</p>
                <p className="text-xs text-muted-foreground">Income swings</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <p className="text-lg font-bold">{summary.dailySavings > 0 ? `₹${summary.dailySavings}` : "—"}</p>
                <p className="text-xs text-muted-foreground">Save per day</p>
              </div>
            </div>
            <div className="text-sm text-green-600 bg-green-50 p-3 rounded">
              ✓ Analysis complete! See updated recommendations on the Tips page, new budgets in Budget, and pending actions in Action Plan.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIAnalysisStatus;
