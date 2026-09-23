import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mic, MicOff, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { voiceProcessor, VoiceTransactionData } from "@/lib/voiceProcessor";
import { toast } from "sonner";

interface VoiceModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (transactionData: any) => void;
}

const VoiceModal = ({ open, onClose, onConfirm }: VoiceModalProps) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [extractedData, setExtractedData] = useState<VoiceTransactionData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    type: "expense" as "income" | "expense",
    category: "",
    description: "",
    merchant: "",
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5)
  });

  const handleStartListening = async () => {
    try {
      if (!voiceProcessor.isSupported()) {
        toast.error("Speech recognition is not supported in your browser");
        return;
      }

      setIsListening(true);
      setTranscript("");
      setExtractedData(null);

      const result = await voiceProcessor.startListening();
      setTranscript(result);

      // Process the transcript
      setIsProcessing(true);
      const data = voiceProcessor.extractTransactionData(result);
      setExtractedData(data);

      // Auto-fill form with extracted data
      setFormData(prev => ({
        ...prev,
        amount: data.amount?.toString() || "",
        type: data.type || "expense",
        category: data.category || "",
        description: data.description || result,
        merchant: data.merchant || ""
      }));

      setIsProcessing(false);
      setIsListening(false);
    } catch (error) {
      console.error("Voice recognition error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to process voice input");
      setIsListening(false);
      setIsProcessing(false);
    }
  };

  const handleStopListening = () => {
    voiceProcessor.stopListening();
    setIsListening(false);
  };

  const handleConfirm = () => {
    if (!formData.amount || !formData.description) {
      toast.error("Please fill in the required fields");
      return;
    }

    const transactionData = {
      ...formData,
      amount: parseFloat(formData.amount),
      source: "voice"
    };

    onConfirm(transactionData);
    handleClose();
  };

  const handleClose = () => {
    voiceProcessor.abort();
    setTranscript("");
    setExtractedData(null);
    setIsListening(false);
    setIsProcessing(false);
    setFormData({
      amount: "",
      type: "expense",
      category: "",
      description: "",
      merchant: "",
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5)
    });
    onClose();
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return "bg-gray-100 text-gray-600";
    if (confidence >= 0.8) return "bg-green-100 text-green-700";
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  const categories = [
    "Food", "Transport", "Shopping", "Entertainment", "Utilities", 
    "Healthcare", "Education", "Groceries", "Travel", "Other"
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Transaction by Voice</DialogTitle>
          <DialogDescription>
            Speak naturally about your transaction and we'll extract the details automatically
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Voice Recording Section */}
          <div className="text-center space-y-4">
            <motion.div
              animate={{ scale: isListening ? 1.1 : 1 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                size="lg"
                variant={isListening ? "destructive" : "default"}
                onClick={isListening ? handleStopListening : handleStartListening}
                disabled={isProcessing}
                className="h-20 w-20 rounded-full"
              >
                {isProcessing ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : isListening ? (
                  <MicOff className="w-8 h-8" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </Button>
            </motion.div>
            
            <p className="text-sm text-muted-foreground">
              {isListening ? "Listening... Click to stop" : 
               isProcessing ? "Processing speech..." :
               "Click to start recording"}
            </p>

            {!voiceProcessor.isSupported() && (
              <Alert>
                <AlertDescription>
                  Speech recognition is not supported in your browser. Please use a modern browser like Chrome.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Transcript Display */}
          {transcript && (
            <div className="space-y-2">
              <Label>What you said:</Label>
              <div className="p-3 bg-muted rounded-lg text-sm">
                "{transcript}"
              </div>
            </div>
          )}

          {/* Extracted Data Preview */}
          {extractedData && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Extracted Information:</Label>
                <Badge className={getConfidenceColor(extractedData.confidence)}>
                  {Math.round((extractedData.confidence || 0) * 100)}% confident
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {extractedData.amount && (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    Amount: ₹{extractedData.amount}
                  </div>
                )}
                {extractedData.type && (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    Type: {extractedData.type}
                  </div>
                )}
                {extractedData.category && (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    Category: {extractedData.category}
                  </div>
                )}
                {extractedData.merchant && (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    Merchant: {extractedData.merchant}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Editable Form */}
          <div className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select value={formData.type} onValueChange={(value: "income" | "expense") => 
                  setFormData(prev => ({ ...prev, type: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => 
                  setFormData(prev => ({ ...prev, category: value }))
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="merchant">Merchant</Label>
                <Input
                  id="merchant"
                  placeholder="Store/merchant name"
                  value={formData.merchant}
                  onChange={(e) => setFormData(prev => ({ ...prev, merchant: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Transaction description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleConfirm} className="flex-1">
              Add Transaction
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceModal;
