import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Home, FileText, Info, AlertCircle, RefreshCw, Calculator, TrendingDown, Briefcase, Car, CheckCircle, IndianRupee } from "lucide-react";
import db from "@/services/database";
import { toast } from "sonner";
import PageIntro from "@/components/PageIntro";
import { hasMinimumTransactions, hasMinimumTransactionsSync } from "@/lib/dataRequirements";
import MinimumDataRequired from "@/components/MinimumDataRequired";

// Tax calculation helper for New Regime FY 2024-25
const calculateTaxNewRegime = (taxableIncome: number): number => {
  if (taxableIncome <= 400000) return 0;
  if (taxableIncome <= 800000) return (taxableIncome - 400000) * 0.05;
  if (taxableIncome <= 1200000) return 20000 + (taxableIncome - 800000) * 0.10;
  if (taxableIncome <= 1600000) return 60000 + (taxableIncome - 1200000) * 0.15;
  if (taxableIncome <= 2000000) return 120000 + (taxableIncome - 1600000) * 0.20;
  if (taxableIncome <= 2400000) return 200000 + (taxableIncome - 2000000) * 0.25;
  return 300000 + (taxableIncome - 2400000) * 0.30;
};

// Apply Section 87A rebate
const applyRebate = (tax: number, taxableIncome: number): number => {
  if (taxableIncome <= 1200000) {
    return Math.max(0, tax - 60000);
  }
  return tax;
};

const Tax = () => {
  const navigate = useNavigate();
  const [taxRecords, setTaxRecords] = useState<any[]>([]);
  // Starts empty (not hardcoded to a specific FY) so loadTaxRecords()'s
  // "auto-select the most recent year with real data" logic below actually
  // runs -- it's guarded by `!selectedYear`, which a hardcoded default
  // permanently defeated, always showing "no tax record" even when a real
  // one existed for the actual current FY.
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [currentRecord, setCurrentRecord] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMinimumData, setHasMinimumData] = useState(() => hasMinimumTransactionsSync());
  const [error, setError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // Calculator state
  const [calcData, setCalcData] = useState({
    salaryIncome: "",
    gigIncome: "",
    otherIncome: "",
    tdsDeducted: "",
    section80C: "",
    section80D: "",
    usePresumptive: true,
    presumptiveRate: "6", // 6% for digital, 8% for cash
  });
  const [calcResult, setCalcResult] = useState<any>(null);

  // Auto-calculate when inputs change
  useEffect(() => {
    if (calcData.salaryIncome || calcData.gigIncome || calcData.otherIncome) {
      handleCalculateTax();
    } else {
      setCalcResult(null);
    }
  }, [calcData]);

  const [manualFormData, setManualFormData] = useState({
    financial_year: new Date().getFullYear() - 1 + "-" + String(new Date().getFullYear()).slice(-2),
    gross_income: "",
    total_deductions: "",
    tax_paid: "",
    filing_status: "not_filed",
    filing_date: "",
    acknowledgement_number: "",
    notes: "",
  });

  useEffect(() => {
    checkDataRequirements();
  }, []);

  useEffect(() => {
    if (hasMinimumData) {
      loadTaxRecords();
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

  useEffect(() => {
    if (selectedYear && taxRecords.length > 0) {
      const record = taxRecords.find((r) => r.financial_year === selectedYear);
      setCurrentRecord(record || null);
    } else {
      setCurrentRecord(null);
    }
  }, [selectedYear, taxRecords]);

  const loadTaxRecords = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await db.taxRecords.getAll();
      setTaxRecords(data || []);

      const years = [...new Set((data || []).map((r) => r.financial_year))].sort().reverse();
      if (years.length > 0 && !selectedYear) {
        setSelectedYear(years[0] as string);
      }
    } catch (err) {
      console.error("Failed to load tax records:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load tax records";
      setError(errorMessage);
      toast.error("Failed to load tax records");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculateTax = () => {
    const salary = parseFloat(calcData.salaryIncome) || 0;
    const gig = parseFloat(calcData.gigIncome) || 0;
    const other = parseFloat(calcData.otherIncome) || 0;
    const tds = parseFloat(calcData.tdsDeducted) || 0;
    const sec80C = Math.min(parseFloat(calcData.section80C) || 0, 150000);
    const sec80D = Math.min(parseFloat(calcData.section80D) || 0, 75000);

    // Calculate gig income based on presumptive or actual
    let taxableGigIncome = gig;
    if (calcData.usePresumptive && gig > 0) {
      const rate = parseFloat(calcData.presumptiveRate) / 100;
      taxableGigIncome = gig * rate; // Only 6% or 8% is taxable!
    }

    // Salary deductions
    const standardDeduction = salary > 0 ? 50000 : 0;
    const netSalary = Math.max(0, salary - standardDeduction);

    // Total income
    const grossIncome = salary + gig + other;
    const totalTaxableIncome = netSalary + taxableGigIncome + other;

    // Apply 80C and 80D only in old regime (simplified for demo - using new regime)
    const taxableAfterDeductions = totalTaxableIncome; // New regime doesn't allow most deductions

    // Calculate tax
    const grossTax = calculateTaxNewRegime(taxableAfterDeductions);
    const taxAfterRebate = applyRebate(grossTax, taxableAfterDeductions);

    // Add cess (4%)
    const totalTax = taxAfterRebate * 1.04;

    // TDS already paid
    const taxDue = Math.max(0, totalTax - tds);
    const refund = tds > totalTax ? tds - totalTax : 0;

    // Determine status message
    let status = "normal";
    let message = "";

    if (totalTaxableIncome <= 400000) {
      status = "no_tax";
      message = "Your income is below the taxable limit. No tax liability!";
    } else if (totalTaxableIncome <= 1200000 && taxAfterRebate === 0) {
      status = "rebate";
      message = "You get full tax rebate under Section 87A. Effective tax = Zero!";
    } else if (refund > 0) {
      status = "refund";
      message = `You may be eligible for a TDS refund of ₹${refund.toLocaleString("en-IN")}!`;
    }

    // Determine ITR form
    let itrForm = "ITR-1";
    if (gig > 0 && calcData.usePresumptive) {
      itrForm = "ITR-4";
    } else if (gig > 0) {
      itrForm = "ITR-3";
    }

    setCalcResult({
      grossIncome,
      salaryIncome: salary,
      gigIncome: gig,
      taxableGigIncome,
      otherIncome: other,
      standardDeduction,
      totalTaxableIncome,
      grossTax,
      rebate: grossTax - taxAfterRebate,
      cess: taxAfterRebate * 0.04,
      totalTax,
      tdsDeducted: tds,
      taxDue,
      refund,
      status,
      message,
      itrForm,
      usePresumptive: calcData.usePresumptive,
      presumptiveRate: calcData.presumptiveRate,
    });
  };

  const handleSaveTaxRecord = async () => {
    try {
      if (!manualFormData.financial_year || !manualFormData.gross_income) {
        toast.error("Please fill in all required fields");
        return;
      }

      await db.taxRecords.create({
        financial_year: manualFormData.financial_year,
        gross_income: parseFloat(manualFormData.gross_income) || 0,
        total_deductions: parseFloat(manualFormData.total_deductions) || 0,
        tax_paid: parseFloat(manualFormData.tax_paid) || 0,
        filing_status: manualFormData.filing_status,
        filing_date: manualFormData.filing_date || undefined,
        acknowledgement_number: manualFormData.acknowledgement_number || undefined,
      });

      toast.success("Tax record saved successfully");
      setIsManualFormOpen(false);
      setManualFormData({
        financial_year: new Date().getFullYear() - 1 + "-" + String(new Date().getFullYear()).slice(-2),
        gross_income: "",
        total_deductions: "",
        tax_paid: "",
        filing_status: "not_filed",
        filing_date: "",
        acknowledgement_number: "",
        notes: "",
      });
      await loadTaxRecords();
    } catch (err) {
      console.error("Failed to save tax record:", err);
      toast.error("Failed to save tax record");
    }
  };

  // Loading State
  if (isLoading && taxRecords.length === 0 && !currentRecord) {
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
          title="Tax Planning"
          description="Manage your tax records and filing"
        />
        <MinimumDataRequired featureName="Tax Analysis" />
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")} title="Back to Home">
            <Home className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Tax Planning</h1>
            <p className="text-[15px] text-muted-foreground">Manage your tax records and filing</p>
          </div>
        </div>

        <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-[15px] font-semibold">Unable to load tax information</AlertTitle>
          <AlertDescription className="text-[13px] mt-1">
            Something went wrong while fetching your tax details.
          </AlertDescription>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={loadTaxRecords}>
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  // Main Content
  const financialYears = [...new Set(taxRecords.map((r) => r.financial_year))].sort().reverse();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")} title="Back to Home">
            <Home className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Tax Planning</h1>
            <p className="text-[15px] text-muted-foreground">Smart tax management for salary + gig income</p>
          </div>
        </div>
        <Button onClick={() => setIsCalculatorOpen(true)}>
          <Calculator className="w-4 h-4 mr-2" />
          Tax Calculator
        </Button>
      </div>

      <PageIntro
        title="What is this page?"
        description="Calculate your tax liability considering both salary and gig income. We use presumptive taxation to minimize your tax on gig earnings."
      />

      {/* Quick Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 border-green-200 bg-green-50 dark:bg-green-950/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">Zero Tax up to ₹12L</h3>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                With Section 87A rebate, income up to ₹12 lakh is effectively tax-free
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
              <Car className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-800 dark:text-blue-200">Presumptive Tax (44AD)</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Only 6% of gig income is taxable if 95%+ payments are digital
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-purple-200 bg-purple-50 dark:bg-purple-950/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
              <TrendingDown className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-purple-800 dark:text-purple-200">TDS Refund</h3>
              <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                Claim back excess TDS deducted by employer or platforms
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tax Records Section */}
      {taxRecords.length > 0 ? (
        <>
          {/* Financial Year Selector */}
          <div className="bg-background border border-border/40 rounded-[6px] p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-4">
              <Label className="text-[13px] font-medium">Financial Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {financialYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {currentRecord ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-background border border-border/40 rounded-[6px] p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
                  <p className="text-[13px] text-muted-foreground font-medium mb-1.5">Gross Income</p>
                  <p className="text-[28px] font-semibold tracking-tight">
                    ₹{Number(currentRecord.gross_income || 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="bg-background border border-border/40 rounded-[6px] p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
                  <p className="text-[13px] text-muted-foreground font-medium mb-1.5">Taxable Income</p>
                  <p className="text-[28px] font-semibold tracking-tight">
                    ₹{Number(currentRecord.taxable_income || 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="bg-background border border-border/40 rounded-[6px] p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
                  <p className="text-[13px] text-muted-foreground font-medium mb-1.5">Tax Liability</p>
                  <p className="text-[28px] font-semibold tracking-tight text-[#dc2626]">
                    ₹{Number(currentRecord.tax_liability || 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="bg-background border border-border/40 rounded-[6px] p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
                  <p className="text-[13px] text-muted-foreground font-medium mb-1.5">Tax Paid (TDS)</p>
                  <p className="text-[28px] font-semibold tracking-tight text-[#16a34a]">
                    ₹{Number(currentRecord.tax_paid || 0).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              {/* Income by Source */}
              <div className="bg-background border border-border/40 rounded-[6px] p-6 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
                <h3 className="text-[18px] font-semibold tracking-tight mb-4">Income by Source</h3>
                {currentRecord.income_by_source && typeof currentRecord.income_by_source === "object" ? (
                  <div className="space-y-3">
                    {Object.entries(currentRecord.income_by_source).map(([source, amount]: [string, any]) => (
                      <div key={source} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          {source.toLowerCase().includes("salary") ? (
                            <Briefcase className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Car className="w-4 h-4 text-green-600" />
                          )}
                          <span className="font-medium">{source}</span>
                        </div>
                        <span className="font-semibold">₹{Number(amount).toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[14px] text-muted-foreground">No income source data available</p>
                )}
              </div>

              {/* Filing Status */}
              <div className="bg-background border border-border/40 rounded-[6px] p-6 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
                <h3 className="text-[18px] font-semibold tracking-tight mb-4">Filing Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={currentRecord.filing_status === "filed" ? "default" : "outline"}>
                      {currentRecord.filing_status || "Not Filed"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Recommended ITR Form</span>
                    <span className="font-semibold">ITR-4 (Sugam)</span>
                  </div>
                  {currentRecord.refund_amount && Number(currentRecord.refund_amount) > 0 && (
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/50 rounded-lg">
                      <span className="text-muted-foreground">Expected Refund</span>
                      <span className="font-semibold text-green-600">
                        ₹{Number(currentRecord.refund_amount).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-background border border-border/40 rounded-[6px] p-12 text-center shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
              <p className="text-[18px] font-semibold mb-2">No tax record found for selected year</p>
              <p className="text-[14px] text-muted-foreground">Use the Tax Calculator to estimate your tax</p>
            </div>
          )}
        </>
      ) : (
        /* Empty State */
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="max-w-md w-full space-y-6">
            <Card className="p-8 text-center border-border/40 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-[6px] bg-muted/60 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
              </div>
              <h2 className="text-[20px] font-semibold tracking-tight text-foreground mb-2">
                No Tax Records Yet
              </h2>
              <p className="text-[14px] text-muted-foreground leading-relaxed mb-4">
                Use the Tax Calculator to estimate your liability with salary + gig income
              </p>
              <Button onClick={() => setIsCalculatorOpen(true)} className="w-full">
                <Calculator className="w-4 h-4 mr-2" />
                Open Tax Calculator
              </Button>
            </Card>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setIsManualFormOpen(true)}
                className="flex-1"
              >
                Add Tax Record Manually
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tax Calculator Sheet */}
      <Sheet open={isCalculatorOpen} onOpenChange={setIsCalculatorOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[20px] font-semibold flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Smart Tax Calculator
            </SheetTitle>
            <SheetDescription className="text-[13px]">
              FY 2024-25 (AY 2025-26) | New Tax Regime
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Income Inputs */}
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <IndianRupee className="w-4 h-4" />
                Income Sources (Annual)
              </h4>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-[13px] flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5" />
                    Salary Income (from IT job, etc.)
                  </Label>
                  <Input
                    type="number"
                    placeholder="e.g., 1200000"
                    value={calcData.salaryIncome}
                    onChange={(e) => setCalcData({ ...calcData, salaryIncome: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    TDS already deducted by employer
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[13px] flex items-center gap-2">
                    <Car className="w-3.5 h-3.5" />
                    Gig Income (Delivery, Driving, Freelance)
                  </Label>
                  <Input
                    type="number"
                    placeholder="e.g., 180000"
                    value={calcData.gigIncome}
                    onChange={(e) => setCalcData({ ...calcData, gigIncome: e.target.value })}
                  />
                </div>

                {parseFloat(calcData.gigIncome) > 0 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-[13px] font-medium">Use Presumptive Taxation (44AD)</Label>
                      <input
                        type="checkbox"
                        checked={calcData.usePresumptive}
                        onChange={(e) => setCalcData({ ...calcData, usePresumptive: e.target.checked })}
                        className="w-4 h-4"
                      />
                    </div>
                    {calcData.usePresumptive && (
                      <div className="space-y-2">
                        <Label className="text-[12px]">Presumptive Rate</Label>
                        <Select
                          value={calcData.presumptiveRate}
                          onValueChange={(v) => setCalcData({ ...calcData, presumptiveRate: v })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="6">6% (95%+ Digital Payments)</SelectItem>
                            <SelectItem value="8">8% (Cash Payments)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-blue-700 dark:text-blue-300">
                          Only {calcData.presumptiveRate}% of ₹{parseFloat(calcData.gigIncome || "0").toLocaleString("en-IN")} = ₹{(parseFloat(calcData.gigIncome || "0") * parseFloat(calcData.presumptiveRate) / 100).toLocaleString("en-IN")} is taxable!
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-[13px]">Other Income (Interest, etc.)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 10000"
                    value={calcData.otherIncome}
                    onChange={(e) => setCalcData({ ...calcData, otherIncome: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[13px]">TDS Already Deducted</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 80000"
                    value={calcData.tdsDeducted}
                    onChange={(e) => setCalcData({ ...calcData, tdsDeducted: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Check Form 16 from employer + Form 26AS for platform TDS
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={handleCalculateTax} className="w-full">
              Calculate Tax
            </Button>

            {/* Results */}
            {calcResult && (
              <div className="space-y-4 pt-4 border-t">
                {/* Status Message */}
                {calcResult.message && (
                  <Alert className={
                    calcResult.status === "no_tax" || calcResult.status === "rebate"
                      ? "border-green-200 bg-green-50 dark:bg-green-950/20"
                      : calcResult.status === "refund"
                        ? "border-purple-200 bg-purple-50 dark:bg-purple-950/20"
                        : ""
                  }>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle className="text-[15px] font-semibold">
                      {calcResult.status === "no_tax" && "No Tax Liability!"}
                      {calcResult.status === "rebate" && "Full Rebate Available!"}
                      {calcResult.status === "refund" && "TDS Refund Available!"}
                    </AlertTitle>
                    <AlertDescription className="text-[13px]">
                      {calcResult.message}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Calculation Breakdown */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Salary Income</span>
                    <span>₹{calcResult.salaryIncome.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">(-) Standard Deduction</span>
                    <span className="text-green-600">-₹{calcResult.standardDeduction.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">
                      Gig Income {calcResult.usePresumptive && `(${calcResult.presumptiveRate}% of ₹${calcResult.gigIncome.toLocaleString("en-IN")})`}
                    </span>
                    <span>₹{calcResult.taxableGigIncome.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Other Income</span>
                    <span>₹{calcResult.otherIncome.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b font-semibold">
                    <span>Total Taxable Income</span>
                    <span>₹{calcResult.totalTaxableIncome.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Gross Tax</span>
                    <span>₹{calcResult.grossTax.toLocaleString("en-IN")}</span>
                  </div>
                  {calcResult.rebate > 0 && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">(-) Section 87A Rebate</span>
                      <span className="text-green-600">-₹{calcResult.rebate.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">(+) Health & Education Cess (4%)</span>
                    <span>₹{Math.round(calcResult.cess).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b font-semibold text-lg">
                    <span>Total Tax</span>
                    <span className="text-red-600">₹{Math.round(calcResult.totalTax).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">(-) TDS Already Paid</span>
                    <span className="text-green-600">-₹{calcResult.tdsDeducted.toLocaleString("en-IN")}</span>
                  </div>

                  {calcResult.refund > 0 ? (
                    <div className="flex justify-between py-3 bg-green-50 dark:bg-green-950/30 rounded-lg px-3 font-bold text-lg">
                      <span className="text-green-700 dark:text-green-300">Refund Due</span>
                      <span className="text-green-600">₹{Math.round(calcResult.refund).toLocaleString("en-IN")}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between py-3 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 font-bold text-lg">
                      <span className="text-red-700 dark:text-red-300">Tax Due</span>
                      <span className="text-red-600">₹{Math.round(calcResult.taxDue).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </div>

                {/* ITR Form Recommendation */}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm">
                    <span className="font-semibold">Recommended ITR Form:</span>{" "}
                    <Badge variant="outline">{calcResult.itrForm}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {calcResult.itrForm === "ITR-4" && "For salary + presumptive business income"}
                    {calcResult.itrForm === "ITR-3" && "For salary + business income with books"}
                    {calcResult.itrForm === "ITR-1" && "For salary income only"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Manual Tax Form Dialog */}
      <Dialog open={isManualFormOpen} onOpenChange={setIsManualFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold">Add Tax Information</DialogTitle>
            <DialogDescription className="text-[13px]">
              Enter your tax details for the financial year
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">Financial Year *</Label>
                <Input
                  value={manualFormData.financial_year}
                  onChange={(e) => setManualFormData({ ...manualFormData, financial_year: e.target.value })}
                  placeholder="e.g., 2024-25"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">Gross Income (₹) *</Label>
                <Input
                  type="number"
                  value={manualFormData.gross_income}
                  onChange={(e) => setManualFormData({ ...manualFormData, gross_income: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">Total Deductions (₹)</Label>
                <Input
                  type="number"
                  value={manualFormData.total_deductions}
                  onChange={(e) => setManualFormData({ ...manualFormData, total_deductions: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">Tax Paid (₹)</Label>
                <Input
                  type="number"
                  value={manualFormData.tax_paid}
                  onChange={(e) => setManualFormData({ ...manualFormData, tax_paid: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium">Filing Status *</Label>
              <Select
                value={manualFormData.filing_status}
                onValueChange={(v) => setManualFormData({ ...manualFormData, filing_status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_filed">Not Filed</SelectItem>
                  <SelectItem value="filed">Filed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">Filing Date</Label>
                <Input
                  type="date"
                  value={manualFormData.filing_date}
                  onChange={(e) => setManualFormData({ ...manualFormData, filing_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">Acknowledgement Number</Label>
                <Input
                  value={manualFormData.acknowledgement_number}
                  onChange={(e) => setManualFormData({ ...manualFormData, acknowledgement_number: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium">Notes</Label>
              <Textarea
                value={manualFormData.notes}
                onChange={(e) => setManualFormData({ ...manualFormData, notes: e.target.value })}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsManualFormOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTaxRecord}
                disabled={!manualFormData.financial_year || !manualFormData.gross_income}
                className="flex-1"
              >
                Save Tax Record
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tax;
