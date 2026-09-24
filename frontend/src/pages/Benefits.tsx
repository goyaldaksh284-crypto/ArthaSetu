import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Home, Search, FileText, CheckCircle, Clock, XCircle, ExternalLink, Award } from "lucide-react";
import { motion } from "framer-motion";
import db from "@/services/database";
import { toast } from "sonner";
import { format } from "date-fns";
import PageIntro from "@/components/PageIntro";
import HelpTooltip from "@/components/HelpTooltip";
import { hasMinimumTransactions, hasMinimumTransactionsSync } from "@/lib/dataRequirements";
import MinimumDataRequired from "@/components/MinimumDataRequired";

const Benefits = () => {
  const navigate = useNavigate();
  const [schemes, setSchemes] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMinimumData, setHasMinimumData] = useState(() => hasMinimumTransactionsSync());
  const [selectedScheme, setSelectedScheme] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"browse" | "my-applications">("browse");
  const [filters, setFilters] = useState({
    scheme_type: "all",
    government_level: "all",
    search: "",
  });
  const [applyFormData, setApplyFormData] = useState({
    application_notes: "",
    documents_submitted: [] as string[],
  });

  useEffect(() => {
    checkDataRequirements();
  }, []);

  useEffect(() => {
    if (hasMinimumData) {
      loadData();
    }
  }, [filters, activeTab, hasMinimumData]);

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
      const [schemesData, applicationsData] = await Promise.all([
        db.governmentSchemes.getAll({
          scheme_type: filters.scheme_type !== "all" ? filters.scheme_type : undefined,
          government_level: filters.government_level !== "all" ? filters.government_level : undefined,
          is_active: true,
        }),
        db.userSchemeApplications.getAll(),
      ]);

      // Apply search filter
      let filteredSchemes = schemesData;
      if (filters.search) {
        const query = filters.search.toLowerCase();
        filteredSchemes = schemesData.filter(
          (s) =>
            s.scheme_name?.toLowerCase().includes(query) ||
            s.description?.toLowerCase().includes(query) ||
            s.scheme_code?.toLowerCase().includes(query)
        );
      }

      setSchemes(filteredSchemes);
      setApplications(applicationsData || []);
    } catch (error) {
      console.error("Failed to load schemes:", error);
      toast.error("Failed to load government schemes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = (scheme: any) => {
    setSelectedScheme(scheme);
    setIsDetailOpen(true);
  };

  const handleApply = (scheme: any) => {
    setSelectedScheme(scheme);
    setApplyFormData({ application_notes: "", documents_submitted: [] });
    setIsApplyOpen(true);
  };

  const handleSubmitApplication = async () => {
    if (!selectedScheme) return;

    try {
      await db.userSchemeApplications.create({
        scheme_id: selectedScheme.scheme_id,
        application_date: new Date().toISOString().split("T")[0],
        application_status: "submitted",
        application_notes: applyFormData.application_notes || undefined,
        documents_submitted: applyFormData.documents_submitted.length > 0 ? applyFormData.documents_submitted : undefined,
      });

      toast.success("Application submitted successfully!");
      setIsApplyOpen(false);
      setSelectedScheme(null);
      loadData();
      setActiveTab("my-applications");
    } catch (error) {
      console.error("Failed to submit application:", error);
      toast.error("Failed to submit application");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
      case "completed":
        return <Badge className="bg-[#16a34a] text-white">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-muted text-muted-foreground">Rejected</Badge>;
      case "under_review":
      case "processing":
        return <Badge className="bg-amber-50 text-amber-700 border border-amber-200">Under Review</Badge>;
      default:
        return <Badge className="bg-blue-50 text-blue-700 border border-blue-200">Submitted</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
      case "completed":
        return <CheckCircle className="w-4 h-4 text-[#16a34a]" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Clock className="w-4 h-4 text-amber-600" />;
    }
  };

  const schemeTypes = [
    { value: "all", label: "All Types" },
    { value: "health", label: "Health" },
    { value: "pension", label: "Pension" },
    { value: "insurance", label: "Insurance" },
    { value: "social_security", label: "Social Security" },
    { value: "education", label: "Education" },
    { value: "housing", label: "Housing" },
    { value: "employment", label: "Employment" },
  ];

  if (isLoading && schemes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-[15px] text-muted-foreground">Checking data requirements...</p>
        </div>
      </div>
    );
  }

  if (!hasMinimumData) {
    return (
      <div className="space-y-6">
        <PageIntro
          title="Government Benefits"
          description="Discover and apply for government schemes and benefits"
        />
        <MinimumDataRequired featureName="Benefits Analysis" />
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
            <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Government Benefits</h1>
            <p className="text-[15px] text-muted-foreground">Discover and apply for government schemes</p>
          </div>
        </div>
      </div>

      <PageIntro
        title="What is this page?"
        description="Here you can see government schemes and benefits you may qualify for, based on your work type, income, and location."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "browse" | "my-applications")}>
        <TabsList className="mb-6">
          <TabsTrigger value="browse">Browse Schemes</TabsTrigger>
          <TabsTrigger value="my-applications">
            My Applications ({applications.length})
          </TabsTrigger>
        </TabsList>

        {/* Browse Schemes Tab */}
        <TabsContent value="browse" className="space-y-6">
          {/* Filters */}
          <div className="bg-background border border-border/40 rounded-[6px] p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search schemes by name, code, or description..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select
                value={filters.scheme_type}
                onValueChange={(v) => setFilters({ ...filters, scheme_type: v })}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {schemeTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.government_level}
                onValueChange={(v) => setFilters({ ...filters, government_level: v })}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="central">Central</SelectItem>
                  <SelectItem value="state">State</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Schemes Grid */}
          {schemes.length === 0 ? (
            <div className="bg-background border border-border/40 rounded-[6px] p-12 text-center shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
              <Award className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-[18px] font-semibold mb-2">No schemes found</p>
              <p className="text-[14px] text-muted-foreground">
                {filters.search || filters.scheme_type !== "all" || filters.government_level !== "all"
                  ? "Try adjusting your filters"
                  : "No government schemes available at the moment"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schemes.map((scheme) => {
                const userApplication = applications.find(
                  (app) => app.scheme_id === scheme.scheme_id
                );
                const hasApplied = !!userApplication;

                return (
                  <motion.div
                    key={scheme.scheme_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -2 }}
                  >
                    <div className="bg-background border border-border/40 rounded-[6px] p-5 h-full flex flex-col shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] hover:shadow-[0_2px_4px_0_rgba(0,0,0,0.08)] transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <Badge
                          variant="outline"
                          className="text-[11px] font-medium"
                        >
                          {scheme.government_level === "central" ? "Central" : "State"}
                        </Badge>
                        {hasApplied && getStatusIcon(userApplication.application_status)}
                      </div>

                      <h3 className="text-[18px] font-semibold tracking-tight mb-2 line-clamp-2">
                        {scheme.scheme_name}
                      </h3>
                      {scheme.scheme_code && (
                        <p className="text-[12px] text-muted-foreground mb-2">Code: {scheme.scheme_code}</p>
                      )}
                      <p className="text-[13px] text-muted-foreground mb-4 line-clamp-3 flex-1">
                        {scheme.description}
                      </p>

                      {scheme.max_benefit_amount && (
                        <div className="mb-3 p-2 bg-muted/30 rounded-[4px]">
                          <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-[11px] text-muted-foreground">Max Benefit</p>
                            <HelpTooltip text="Maximum value or coverage you can get from this scheme if you are eligible and approved." />
                          </div>
                          <p className="text-[15px] font-semibold">
                            ₹{Number(scheme.max_benefit_amount).toLocaleString("en-IN")}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2 mt-auto pt-4 border-t border-border/40">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(scheme)}
                          className="flex-1 text-[13px]"
                        >
                          View Details
                        </Button>
                        {!hasApplied ? (
                          <Button
                            size="sm"
                            onClick={() => handleApply(scheme)}
                            className="flex-1 text-[13px]"
                          >
                            Apply
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setActiveTab("my-applications");
                            }}
                            className="flex-1 text-[13px]"
                          >
                            View Status
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* My Applications Tab */}
        <TabsContent value="my-applications" className="space-y-4">
          {applications.length === 0 ? (
            <div className="bg-background border border-border/40 rounded-[6px] p-12 text-center shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-[18px] font-semibold mb-2">No applications yet</p>
              <p className="text-[14px] text-muted-foreground mb-4">
                Browse schemes and apply for benefits you're eligible for
              </p>
              <Button onClick={() => setActiveTab("browse")} variant="outline">
                Browse Schemes
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => {
                const scheme = app.government_schemes;
                return (
                  <div
                    key={app.id}
                    className="bg-background border border-border/40 rounded-[6px] p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-[18px] font-semibold tracking-tight">
                            {scheme?.scheme_name || "Unknown Scheme"}
                          </h3>
                          {getStatusBadge(app.application_status)}
                        </div>
                        {scheme?.scheme_code && (
                          <p className="text-[12px] text-muted-foreground mb-2">Code: {scheme.scheme_code}</p>
                        )}
                      </div>
                      {getStatusIcon(app.application_status)}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3 text-[13px]">
                      <div>
                        <p className="text-muted-foreground">Application Date</p>
                        <p className="font-medium">
                          {app.application_date
                            ? format(new Date(app.application_date), "MMM dd, yyyy")
                            : "N/A"}
                        </p>
                      </div>
                      {app.approval_date && (
                        <div>
                          <p className="text-muted-foreground">Approval Date</p>
                          <p className="font-medium">
                            {format(new Date(app.approval_date), "MMM dd, yyyy")}
                          </p>
                        </div>
                      )}
                      {app.benefit_received && (
                        <div>
                          <p className="text-muted-foreground">Benefit Received</p>
                          <p className="font-medium text-[#16a34a]">
                            ₹{Number(app.benefit_received).toLocaleString("en-IN")}
                          </p>
                        </div>
                      )}
                    </div>

                    {app.application_notes && (
                      <div className="mb-3 p-3 bg-muted/30 rounded-[4px]">
                        <p className="text-[12px] text-muted-foreground mb-1">Notes</p>
                        <p className="text-[13px]">{app.application_notes}</p>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const schemeData = schemes.find((s) => s.scheme_id === app.scheme_id);
                        if (schemeData) {
                          handleViewDetails(schemeData);
                        }
                      }}
                      className="w-full text-[13px]"
                    >
                      View Scheme Details
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Scheme Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedScheme && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[11px]">
                    {selectedScheme.government_level === "central" ? "Central" : "State"} Government
                  </Badge>
                  {selectedScheme.scheme_type && (
                    <Badge variant="outline" className="text-[11px] capitalize">
                      {selectedScheme.scheme_type.replace("_", " ")}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-[20px] font-semibold">{selectedScheme.scheme_name}</DialogTitle>
                {selectedScheme.scheme_code && (
                  <DialogDescription>Scheme Code: {selectedScheme.scheme_code}</DialogDescription>
                )}
              </DialogHeader>

              <div className="space-y-5">
                <div>
                  <h4 className="text-[15px] font-semibold mb-2">Description</h4>
                  <p className="text-[14px] text-muted-foreground leading-relaxed">{selectedScheme.description}</p>
                </div>

                {selectedScheme.benefits && (
                  <div>
                    <h4 className="text-[15px] font-semibold mb-2">Benefits</h4>
                    <div className="bg-muted/30 rounded-[6px] p-4 border border-border/40">
                      <p className="text-[14px] text-muted-foreground whitespace-pre-line">
                        {selectedScheme.benefits}
                      </p>
                    </div>
                  </div>
                )}

                {selectedScheme.max_benefit_amount && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[13px] text-muted-foreground mb-1">Maximum Benefit</p>
                      <p className="text-[20px] font-semibold">
                        ₹{Number(selectedScheme.max_benefit_amount).toLocaleString("en-IN")}
                      </p>
                    </div>
                    {selectedScheme.interest_rate && (
                      <div>
                        <p className="text-[13px] text-muted-foreground mb-1">Interest Rate</p>
                        <p className="text-[20px] font-semibold">{selectedScheme.interest_rate}%</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedScheme.eligibility_criteria && (
                  <div>
                    <h4 className="text-[15px] font-semibold mb-2">Eligibility Criteria</h4>
                    <div className="bg-muted/30 rounded-[6px] p-4 border border-border/40">
                      {typeof selectedScheme.eligibility_criteria === "string" ? (
                        <p className="text-[14px] text-muted-foreground whitespace-pre-line">
                          {selectedScheme.eligibility_criteria}
                        </p>
                      ) : (
                        <ul className="list-disc list-inside space-y-1 text-[14px] text-muted-foreground">
                          {Object.entries(selectedScheme.eligibility_criteria).map(([key, value]: [string, any]) => (
                            <li key={key}>
                              <span className="font-medium">{key}:</span> {String(value)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                {selectedScheme.application_process && (
                  <div>
                    <h4 className="text-[15px] font-semibold mb-2">Application Process</h4>
                    <div className="bg-muted/30 rounded-[6px] p-4 border border-border/40">
                      <p className="text-[14px] text-muted-foreground whitespace-pre-line">
                        {selectedScheme.application_process}
                      </p>
                    </div>
                  </div>
                )}

                {selectedScheme.required_documents && (
                  <div>
                    <h4 className="text-[15px] font-semibold mb-2">Required Documents</h4>
                    <div className="bg-muted/30 rounded-[6px] p-4 border border-border/40">
                      {Array.isArray(selectedScheme.required_documents) ? (
                        <ul className="list-disc list-inside space-y-1 text-[14px] text-muted-foreground">
                          {selectedScheme.required_documents.map((doc: string, idx: number) => (
                            <li key={idx}>{doc}</li>
                          ))}
                        </ul>
                      ) : typeof selectedScheme.required_documents === "object" ? (
                        <ul className="list-disc list-inside space-y-1 text-[14px] text-muted-foreground">
                          {Object.values(selectedScheme.required_documents).map((doc: any, idx: number) => (
                            <li key={idx}>{String(doc)}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[14px] text-muted-foreground">
                          {String(selectedScheme.required_documents)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedScheme.valid_from && selectedScheme.valid_until && (
                  <div className="grid grid-cols-2 gap-4 text-[13px]">
                    <div>
                      <p className="text-muted-foreground">Valid From</p>
                      <p className="font-medium">
                        {format(new Date(selectedScheme.valid_from), "MMM dd, yyyy")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Valid Until</p>
                      <p className="font-medium">
                        {format(new Date(selectedScheme.valid_until), "MMM dd, yyyy")}
                      </p>
                    </div>
                  </div>
                )}

                {selectedScheme.official_url && (
                  <div>
                    <Button
                      variant="outline"
                      onClick={() => window.open(selectedScheme.official_url, "_blank")}
                      className="w-full"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Visit Official Website
                    </Button>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="flex-1">
                    Close
                  </Button>
                  {!applications.find((app) => app.scheme_id === selectedScheme.scheme_id) && (
                    <Button onClick={() => {
                      setIsDetailOpen(false);
                      handleApply(selectedScheme);
                    }} className="flex-1">
                      Apply Now
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Apply Dialog */}
      <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
        <DialogContent className="max-w-2xl">
          {selectedScheme && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[18px] font-semibold">Apply for {selectedScheme.scheme_name}</DialogTitle>
                <DialogDescription className="text-[13px]">
                  Fill in the application details below
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="bg-muted/30 rounded-[6px] p-4 border border-border/40">
                  <p className="text-[13px] text-muted-foreground mb-2">
                    <strong>Application Date:</strong> {format(new Date(), "MMMM dd, yyyy")}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    <strong>Status:</strong> Will be set to "Submitted" upon application
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[13px] font-medium">Application Notes (Optional)</Label>
                  <Textarea
                    value={applyFormData.application_notes}
                    onChange={(e) => setApplyFormData({ ...applyFormData, application_notes: e.target.value })}
                    placeholder="Add any additional notes or information..."
                    rows={4}
                  />
                </div>

                {selectedScheme.required_documents && (
                  <div className="space-y-2">
                    <Label className="text-[13px] font-medium">Required Documents</Label>
                    <div className="bg-muted/30 rounded-[6px] p-3 border border-border/40">
                      {Array.isArray(selectedScheme.required_documents) ? (
                        <ul className="list-disc list-inside space-y-1 text-[13px] text-muted-foreground">
                          {selectedScheme.required_documents.map((doc: string, idx: number) => (
                            <li key={idx}>{doc}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[13px] text-muted-foreground">
                          Please refer to the scheme details for required documents.
                        </p>
                      )}
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      Note: Document submission will be handled through the official application process.
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setIsApplyOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleSubmitApplication} className="flex-1">
                    Submit Application
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

export default Benefits;


