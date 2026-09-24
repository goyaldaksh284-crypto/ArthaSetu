import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lightbulb, Search, CheckCircle, XCircle, Clock, Home } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import db from "@/services/database";
import { toast } from "sonner";
import type { Recommendation } from "@/services/database";
import PageIntro from "@/components/PageIntro";
import { hasMinimumTransactions, hasMinimumTransactionsSync } from "@/lib/dataRequirements";
import MinimumDataRequired from "@/components/MinimumDataRequired";
import db, { getLocal, DEFAULT_RECOMMENDATIONS } from "@/services/database";

const Tips = () => {
  const navigate = useNavigate();
  const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') || 'usr-demo-101' : 'usr-demo-101';
  const initialRecs = getLocal<Recommendation[]>(`arthasetu_recs_${userId}`, DEFAULT_RECOMMENDATIONS);
  const [recommendations, setRecommendations] = useState<Recommendation[]>(initialRecs);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMinimumData, setHasMinimumData] = useState(() => hasMinimumTransactionsSync());
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    priority: "all",
    recommendation_type: "all",
    search: "",
  });

  useEffect(() => {
    checkDataRequirements();
  }, []);

  useEffect(() => {
    if (hasMinimumData) {
      loadRecommendations();
    }
  }, [filters, hasMinimumData]);

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

  const loadRecommendations = async () => {
    try {
      const data = await db.recommendations.getAll({
        status: filters.status !== "all" ? filters.status : undefined,
        priority: filters.priority !== "all" ? filters.priority : undefined,
        recommendation_type: filters.recommendation_type !== "all" ? filters.recommendation_type : undefined,
      });
      
      // Apply search filter
      let filtered = data;
      if (filters.search) {
        const query = filters.search.toLowerCase();
        filtered = data.filter(
          (r) =>
            r.title?.toLowerCase().includes(query) ||
            r.description?.toLowerCase().includes(query)
        );
      }
      
      setRecommendations(filtered);
    } catch (error) {
      console.error("Failed to load recommendations:", error);
      toast.error("Failed to load recommendations");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkDone = async (id: string) => {
    try {
      await db.recommendations.update(id, { status: "completed" });
      toast.success("Marked as completed!");
      loadRecommendations();
    } catch (error) {
      toast.error("Failed to update recommendation");
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800";
      case "medium":
        return "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800";
      case "low":
        return "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800";
      default:
        return "bg-muted text-muted-foreground border border-border/40";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-[#16a34a]" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Clock className="w-4 h-4 text-amber-600" />;
    }
  };

  if (isLoading && recommendations.length === 0) {
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
          title="Tips & Recommendations"
          description="Get personalized financial advice based on your spending patterns"
        />
        <MinimumDataRequired featureName="Tips & Recommendations" />
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
          <h1 className="text-3xl font-bold">AI Recommendations</h1>
            <p className="text-muted-foreground">Personalized financial tips powered by AI</p>
          </div>
        </div>
        <Button onClick={loadRecommendations} variant="outline">
          🔄 Refresh Tips
        </Button>
      </div>

      <PageIntro
        title="What is this page?"
        description="These are money suggestions tailored to you. Each tip explains what to change and how it can improve your situation."
      />

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search recommendations..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>
          <Select
            value={filters.status}
            onValueChange={(v) => setFilters({ ...filters, status: v })}
          >
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="actioned">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.priority}
            onValueChange={(v) => setFilters({ ...filters, priority: v })}
          >
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.recommendation_type}
            onValueChange={(v) => setFilters({ ...filters, recommendation_type: v })}
          >
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="savings">Savings</SelectItem>
              <SelectItem value="budget">Budget</SelectItem>
              <SelectItem value="debt">Debt</SelectItem>
              <SelectItem value="risk">Risk</SelectItem>
              <SelectItem value="tax">Tax</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Recommendations Grid */}
        {recommendations.length === 0 ? (
        <Card className="p-12 text-center">
          <Lightbulb className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-semibold">No recommendations found</p>
          <p className="text-muted-foreground mt-2">
            {filters.status !== "all" || filters.priority !== "all" || filters.search
              ? "Try adjusting your filters"
              : "Check back later for personalized recommendations"}
          </p>
          </Card>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendations.map((rec) => (
                <motion.div
              key={rec.recommendation_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -5 }}
            >
              <Card className="p-6 h-full flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => {
                  setSelectedRec(rec);
                  setIsDetailOpen(true);
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <Badge className={getPriorityColor(rec.priority || "medium")}>
                    {rec.priority?.toUpperCase() || "MEDIUM"}
                  </Badge>
                  {getStatusIcon(rec.status)}
                </div>

                <h3 className="font-bold text-lg mb-2 line-clamp-2">{rec.title}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-1">
                  {rec.description}
                </p>

                <div className="flex items-center justify-between mt-auto pt-4 border-t">
                  <div className="text-xs text-muted-foreground">
                    {rec.confidence_score && (
                      <span>Confidence: {Math.round(rec.confidence_score * 100)}%</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkDone(rec.recommendation_id);
                    }}
                  >
                    Mark Done
                        </Button>
                      </div>
                  </Card>
                </motion.div>
              ))}
          </div>
        )}

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRec && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getPriorityColor(selectedRec.priority || "medium")}>
                    {selectedRec.priority?.toUpperCase() || "MEDIUM"}
                  </Badge>
                  {getStatusIcon(selectedRec.status)}
                </div>
                <DialogTitle>{selectedRec.title}</DialogTitle>
                <DialogDescription>{selectedRec.recommendation_type}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">{selectedRec.description}</p>
      </div>

                {selectedRec.reasoning && (
                  <div>
                    <h4 className="font-semibold mb-2">AI Reasoning</h4>
                    <p className="text-sm text-muted-foreground">{selectedRec.reasoning}</p>
                  </div>
                )}

                {selectedRec.action_items && Array.isArray(selectedRec.action_items) && selectedRec.action_items.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Action Items</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {selectedRec.action_items.map((item: string | { step?: string; timeline?: string; [key: string]: any }, idx: number) => {
                        // Handle both string and object formats
                        const displayText = typeof item === 'string' 
                          ? item 
                          : (item?.step || (item as any)?.timeline || JSON.stringify(item));
                        return (
                          <li key={idx}>{displayText}</li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {selectedRec.target_amount && (
                    <div>
                      <p className="text-sm text-muted-foreground">Target Amount</p>
                      <p className="font-semibold">₹{selectedRec.target_amount.toLocaleString("en-IN")}</p>
                    </div>
                  )}
                  {selectedRec.confidence_score && (
              <div>
                      <p className="text-sm text-muted-foreground">Confidence</p>
                      <p className="font-semibold">{Math.round(selectedRec.confidence_score * 100)}%</p>
                  </div>
                )}
              </div>

                <div>
                  <h4 className="font-semibold mb-2">Your Feedback</h4>
                  <Textarea
                    placeholder="What do you think about this recommendation?"
                    defaultValue={selectedRec.user_feedback || ""}
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      db.recommendations.update(selectedRec.recommendation_id, {
                        status: "accepted",
                      });
                      toast.success("Marked as accepted!");
                      setIsDetailOpen(false);
                      loadRecommendations();
                    }}
                  >
                    Helpful
                  </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                      db.recommendations.update(selectedRec.recommendation_id, {
                        status: "rejected",
                      });
                      toast.success("Marked as not relevant");
                      setIsDetailOpen(false);
                      loadRecommendations();
                    }}
                  >
                    Not Relevant
                </Button>
                <Button
                  onClick={() => {
                      handleMarkDone(selectedRec.recommendation_id);
                      setIsDetailOpen(false);
                  }}
                    className="flex-1"
                >
                    Already Following This
                </Button>
              </div>
            </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tips;
