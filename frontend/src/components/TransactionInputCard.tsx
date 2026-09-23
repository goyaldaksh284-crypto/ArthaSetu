import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Upload, Mic, PenLine, ChevronDown, ChevronUp, Square, Loader2, ScanText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import db from "@/services/database";
import { imageProcessor, validateImageFile, preloadScanner } from "@/lib/imageProcessor";
import { voiceProcessor } from "@/lib/voiceProcessor";
import type { ExtractedTransaction } from "@/lib/transactionExtractor";
import { toast } from "sonner";

interface TransactionInputCardProps {
  onSuccess?: () => void;
}

const TransactionInputCard = ({ onSuccess }: TransactionInputCardProps) => {
  const [activeMode, setActiveMode] = useState<"manual" | "image" | "voice">("manual");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("");
  const [micSupported] = useState(() => voiceProcessor.isSupported());

  // Manual transaction form state
  const [formData, setFormData] = useState({
    amount: "",
    transaction_type: "expense" as "income" | "expense",
    transaction_date: new Date(),
    transaction_time: new Date().toTimeString().slice(0, 5), // HH:mm, matches <input type="time">'s required format
    category: "",
    subcategory: "",
    payment_method: "",
    account_id: "",
    source: "",
    description: "",
    merchant_name: "",
    location: "",
    tags: [] as string[],
    is_recurring: false,
    recurring_frequency: "",
  });

  const categories = {
    income: ["Delivery", "Freelance", "Salary", "Other"],
    expense: ["Food", "Fuel", "Rent", "Groceries", "Maintenance", "Phone", "EMI", "Misc"],
  };

  const paymentMethods = ["UPI", "Cash", "Card", "Bank Transfer"];
  const recurringFrequencies = ["Daily", "Weekly", "Monthly", "Custom"];

  // Stop any in-flight speech recognition if the card unmounts mid-session,
  // and warm up the OCR engine whenever the Image tab is opened.
  useEffect(() => {
    return () => voiceProcessor.abort();
  }, []);

  useEffect(() => {
    if (activeMode === "image") preloadScanner();
  }, [activeMode]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.category) {
      toast.error("Please fill required fields");
      return;
    }

    try {
      setIsSubmitting(true);
      await db.transactions.create({
        transaction_date: format(formData.transaction_date, "yyyy-MM-dd"),
        transaction_time: formData.transaction_time,
        amount: parseFloat(formData.amount),
        transaction_type: formData.transaction_type,
        category: formData.category,
        subcategory: formData.subcategory || undefined,
        description: formData.description || undefined,
        payment_method: formData.payment_method || undefined,
        merchant_name: formData.merchant_name || undefined,
        location: formData.location || undefined,
        source: formData.source || undefined,
        account_id: formData.account_id || undefined,
        is_recurring: formData.is_recurring,
        recurring_frequency: formData.recurring_frequency || undefined,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
        input_method: pendingInputMethod.current,
        confidence_score: pendingConfidence.current,
      });
      pendingInputMethod.current = "manual";
      pendingConfidence.current = undefined;
      toast.success("Transaction added successfully!");
      // Reset form
      setFormData({
        amount: "",
        transaction_type: "expense",
        transaction_date: new Date(),
        transaction_time: new Date().toTimeString().slice(0, 5), // HH:mm, matches <input type="time">'s required format
        category: "",
        subcategory: "",
        payment_method: "",
        account_id: "",
        source: "",
        description: "",
        merchant_name: "",
        location: "",
        tags: [],
        is_recurring: false,
        recurring_frequency: "",
      });
      setOcrText("");
      setLastConfidence(null);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Fill the manual form with data extracted from a receipt scan or a voice
   * command and switch to the manual tab so the user can review it. The raw
   * recognized text (OCR output / transcript) goes into the Description field.
   * Never invents values: anything the extractor couldn't find is left blank.
   */
  const applyExtracted = (data: ExtractedTransaction, inputMethod: "image" | "voice", rawText?: string) => {
    const validCategories = categories[data.type];
    const category = validCategories.includes(data.category)
      ? data.category
      : validCategories[validCategories.length - 1];

    setFormData((prev) => ({
      ...prev,
      amount: data.amount !== null ? String(data.amount) : "",
      transaction_type: data.type,
      category,
      merchant_name: data.merchant || "",
      description: rawText?.trim() || data.description || "",
      payment_method: paymentMethods.includes(data.paymentMethod as (typeof paymentMethods)[number])
        ? data.paymentMethod
        : "",
      source: data.merchant || "",
      transaction_date: data.date ? new Date(`${data.date}T00:00:00`) : new Date(),
      transaction_time: data.time || prev.transaction_time,
      tags: prev.tags,
      is_recurring: prev.is_recurring,
      recurring_frequency: prev.recurring_frequency,
    }));
    // The Description field lives inside the "More Details" section — open it
    // so the recognized text is visible right away.
    if (rawText && rawText.trim()) {
      setShowAdvanced(true);
    }
    // Stash how this row was captured so it is saved with the transaction.
    pendingInputMethod.current = inputMethod;
    pendingConfidence.current = data.confidence;

    setLastConfidence(data.confidence);
    setActiveMode("manual");

    if (data.amount === null) {
      toast.warning(
        inputMethod === "image"
          ? "Scanned the receipt, but couldn't detect the amount — please enter it manually."
          : "Heard you, but couldn't detect an amount — please enter it manually.",
      );
    } else {
      toast.success(
        `Transaction extracted with ${Math.round(data.confidence * 100)}% confidence. Please review and confirm.`,
      );
    }
  };

  // Carried into db.transactions.create on submit (see handleManualSubmit).
  const pendingInputMethod = useRef<"manual" | "image" | "voice">("manual");
  const pendingConfidence = useRef<number | undefined>(undefined);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      validateImageFile(file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid image");
      return;
    }

    setIsProcessing(true);
    setProgressLabel("Loading scanner...");
    setOcrText("");

    try {
      const data = await imageProcessor.extractTransactionFromImage(file, (status) => {
        setProgressLabel(status);
      });
      setOcrText(data.text);
      applyExtracted(data, "image", data.text);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process image");
    } finally {
      setIsProcessing(false);
      setProgressLabel("");
    }
  };

  const handleVoiceRecord = async () => {
    if (isListening) {
      voiceProcessor.stopListening();
      return;
    }

    if (!micSupported) {
      toast.error("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    setIsListening(true);
    setLiveTranscript("");
    setVoiceStatus("");

    try {
      const transcript = await voiceProcessor.startListening({
        onInterim: setLiveTranscript,
        onStatus: setVoiceStatus,
      });
      setLiveTranscript(transcript);
      const data = await voiceProcessor.extractTransactionDataAI(transcript);
      applyExtracted(data, "voice", transcript);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not process your voice. Please try again.");
    } finally {
      setIsListening(false);
    }
  };

  return (
    <Card className="p-6">
      <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as any)}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <PenLine className="w-4 h-4" />
            Manual
          </TabsTrigger>
          <TabsTrigger value="image" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Image
          </TabsTrigger>
          <TabsTrigger value="voice" className="flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Voice
          </TabsTrigger>
        </TabsList>

        {/* Manual Mode */}
        <TabsContent value="manual">
          <form onSubmit={handleManualSubmit} className="space-y-4">
            {/* Amount & Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
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

            {/* Date & Time */}
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

            {/* Category & Payment Method */}
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
                    {paymentMethods.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Section Toggle */}
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
              More Details
            </Button>

            {/* Advanced Fields */}
            {showAdvanced && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subcategory</Label>
                    <Input
                      value={formData.subcategory}
                      onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Source</Label>
                    <Input
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      placeholder="e.g., Uber, Swiggy"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Merchant Name</Label>
                    <Input
                      value={formData.merchant_name}
                      onChange={(e) => setFormData({ ...formData, merchant_name: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                {/* Recurring */}
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.is_recurring}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
                  />
                  <Label>Is this a recurring transaction?</Label>
                </div>

                {formData.is_recurring && (
                  <div className="space-y-2">
                    <Label>Recurring Frequency</Label>
                    <Select
                      value={formData.recurring_frequency}
                      onValueChange={(v) => setFormData({ ...formData, recurring_frequency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        {recurringFrequencies.map((freq) => (
                          <SelectItem key={freq} value={freq}>
                            {freq}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Transaction"}
            </Button>
          </form>
        </TabsContent>

        {/* Image Mode */}
        <TabsContent value="image">
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <Label htmlFor="image-upload" className="cursor-pointer">
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/bmp"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={isProcessing}
                />
                <Button type="button" variant="outline" asChild disabled={isProcessing}>
                  <span>{isProcessing ? "Processing..." : "Upload Receipt/Bill Image"}</span>
                </Button>
              </Label>
              <p className="text-sm text-muted-foreground mt-2">
                {isProcessing
                  ? progressLabel || "Extracting transaction details..."
                  : "Your receipt is read right in the browser — we'll extract the amount, merchant and category automatically"}
              </p>
            </div>

            {ocrText && !isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <ScanText className="w-4 h-4" />
                    Text we read from the receipt:
                  </Label>
                  {lastConfidence !== null && (
                    <span className="text-xs text-muted-foreground">
                      {Math.round(lastConfidence * 100)}% confident
                    </span>
                  )}
                </div>
                <div className="p-3 bg-muted rounded-lg text-xs max-h-32 overflow-y-auto">
                  {ocrText}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Voice Mode */}
        <TabsContent value="voice">
          <div className="space-y-4">
            {!micSupported && (
              <div className="p-4 border border-amber-300 bg-amber-50 text-amber-800 rounded-lg text-sm">
                Speech recognition is not supported in this browser. Please use Google Chrome or
                Microsoft Edge to add transactions by voice.
              </div>
            )}
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Mic className={cn(
                "w-12 h-12 mx-auto mb-4",
                isListening ? "text-red-500 animate-pulse" : "text-muted-foreground"
              )} />
              <Button
                type="button"
                onClick={handleVoiceRecord}
                size="lg"
                disabled={isProcessing || !micSupported}
                variant={isListening ? "destructive" : "default"}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : isListening ? (
                  <>
                    <Square className="w-5 h-5 mr-2" />
                    Stop Listening
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5 mr-2" />
                    Start Listening
                  </>
                )}
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                {isListening
                  ? voiceStatus || "Listening... speak like \"I spent 250 rupees on petrol\""
                  : "Tap, then speak your transaction naturally"}
              </p>
              {isListening && (
                <div className="mt-4 space-y-2">
                  {voiceStatus && (
                    <p className="text-xs text-muted-foreground animate-pulse">{voiceStatus}</p>
                  )}
                  <div className="p-3 bg-muted rounded-lg text-sm min-h-12">
                    {liveTranscript || <span className="text-muted-foreground">Say something...</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default TransactionInputCard;
