import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, Upload, CheckCircle, XCircle, Loader2, Image } from "lucide-react";
import { motion } from "framer-motion";
import { imageProcessor, ImageTransactionData } from "@/lib/imageProcessor";
import { toast } from "sonner";

interface ScanModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (transactionData: any) => void;
}

const ScanModal = ({ open, onClose, onConfirm }: ScanModalProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ImageTransactionData | null>(null);
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    try {
      imageProcessor.validateImageFile(file);
      setSelectedFile(file);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      // Process the image
      processImage(file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid file");
    }
  };

  const processImage = async (file: File) => {
    try {
      setIsProcessing(true);
      const data = await imageProcessor.extractTransactionFromImage(file);
      setExtractedData(data);
      
      // Auto-fill form with extracted data
      setFormData(prev => ({
        ...prev,
        amount: data.amount?.toString() || "",
        type: data.type || "expense",
        category: data.category || "",
        description: data.description || "",
        merchant: data.merchant || "",
        date: data.date || new Date().toISOString().split('T')[0]
      }));
      
    } catch (error) {
      console.error("Image processing error:", error);
      toast.error("Failed to process image");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleConfirm = () => {
    if (!formData.amount || !formData.description) {
      toast.error("Please fill in the required fields");
      return;
    }

    const transactionData = {
      ...formData,
      amount: parseFloat(formData.amount),
      source: "scan"
    };

    onConfirm(transactionData);
    handleClose();
  };

  const handleClose = () => {
    setSelectedFile(null);
    setExtractedData(null);
    setIsProcessing(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
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
          <DialogTitle>Scan Receipt/Bill</DialogTitle>
          <DialogDescription>
            Upload or take a photo of your receipt and we'll extract the transaction details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Section */}
          {!selectedFile && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={handleUploadClick}
                  className="h-24 flex flex-col gap-2"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-sm">Upload Image</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCameraClick}
                  className="h-24 flex flex-col gap-2"
                >
                  <Camera className="w-6 h-6" />
                  <span className="text-sm">Take Photo</span>
                </Button>
              </div>
              
              <Alert>
                <Image className="h-4 w-4" />
                <AlertDescription>
                  Supported formats: JPEG, PNG, WebP (max 5MB)
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Image Preview */}
          {previewUrl && (
            <div className="space-y-2">
              <Label>Selected Image:</Label>
              <div className="relative">
                <img 
                  src={previewUrl} 
                  alt="Receipt preview" 
                  className="w-full max-h-40 object-contain border rounded-lg"
                />
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                    <div className="flex items-center gap-2 text-white">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Processing...</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  setSelectedFile(null);
                  setExtractedData(null);
                  if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }
                }}>
                  Remove
                </Button>
                <Button variant="outline" size="sm" onClick={handleUploadClick}>
                  Replace
                </Button>
              </div>
            </div>
          )}

          {/* Extracted Data Preview */}
          {extractedData && !isProcessing && (
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
                {extractedData.merchant && (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    Merchant: {extractedData.merchant}
                  </div>
                )}
                {extractedData.category && (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    Category: {extractedData.category}
                  </div>
                )}
                {extractedData.date && (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    Date: {extractedData.date}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Editable Form */}
          {(extractedData || selectedFile) && (
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

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={handleConfirm} 
                  className="flex-1"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Add Transaction"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScanModal;

