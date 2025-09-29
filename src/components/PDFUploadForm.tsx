import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Upload, FileText, AlertCircle, CheckCircle, Edit2, Trash2, Save, X } from "lucide-react";
import { useFinancifyStore } from "@/store";
import { toast } from "@/components/ui/use-toast";
import { parseBcaStatementPdf } from "@/lib/bca-pdf-parser";
import { MoneyDisplay } from "./MoneyDisplay";
import type { ImportedTransaction } from "@/store";

interface PDFUploadFormProps {
  onClose: () => void;
}

export const PDFUploadForm = ({ onClose }: PDFUploadFormProps) => {
  const { setImportedDraft, saveTransactions } = useFinancifyStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [detectedTransactions, setDetectedTransactions] = useState<ImportedTransaction[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Please select a PDF file.');
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
        setError('File size must be less than 10MB.');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setPreview(selectedFile.name);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a PDF file first.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const transactions = await parseBcaStatementPdf(file);
      
      if (transactions.length === 0) {
        setError('No transactions found in the PDF. Please check if it\'s a valid bank statement.');
        return;
      }

      // Show detected transactions for review
      setDetectedTransactions(transactions);
      
      toast({
        title: "PDF Processed Successfully",
        description: `Found ${transactions.length} transactions. Please review and edit them before saving.`,
      });
    } catch (error) {
      console.error('PDF processing error:', error);
      setError('Failed to process PDF. Please make sure it\'s a valid BCA bank statement.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditTransaction = (index: number) => {
    setEditingTransaction(index.toString());
  };

  const handleSaveTransaction = (index: number, updatedTransaction: ImportedTransaction) => {
    setDetectedTransactions(prev => 
      prev.map((t, i) => i === index ? updatedTransaction : t)
    );
    setEditingTransaction(null);
    toast({
      title: "Transaction Updated",
      description: "Transaction has been successfully updated.",
    });
  };

  const handleDeleteTransaction = (index: number) => {
    setDetectedTransactions(prev => prev.filter((_, i) => i !== index));
    toast({
      title: "Transaction Deleted",
      description: "Transaction has been removed from the list.",
    });
  };

  const handleSaveAllTransactions = async () => {
    if (detectedTransactions.length === 0) {
      setError('No transactions to save.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // First, categorize the transactions automatically
      const categorizedTransactions = await categorizeTransactions(detectedTransactions);
      
      // Update the local state with categorized transactions
      setDetectedTransactions(categorizedTransactions);
      
      // Save the categorized transactions
      await saveTransactions(categorizedTransactions);
      setImportedDraft([]);
      
      toast({
        title: "Transactions Saved & Categorized",
        description: `${categorizedTransactions.length} transactions have been automatically categorized and saved.`,
      });

      // Close the form
      onClose();
    } catch (error) {
      console.error('Error saving transactions:', error);
      setError('Failed to save transactions. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingTransaction(null);
  };

  const categorizeTransactions = async (transactions: ImportedTransaction[]): Promise<ImportedTransaction[]> => {
    setIsCategorizing(true);
    
    try {
      // Simple deterministic categorizer based on keywords (same as ImportScreen)
      const categorized = transactions.map(t => {
        const desc = t.description.toLowerCase();
        let category = t.category;
        if (!category) {
          if (/(salary|gaji|payroll|transfer.*(gaji|salary))/i.test(desc)) category = 'Salary / Wages';
          else if (/(indomaret|alfamart|supermarket|mini market|grocer|hypermart)/i.test(desc)) category = 'Food & Dining';
          else if (/(tokopedia|shopee|lazada|blibli|ecommerce|marketplace)/i.test(desc)) category = 'Shopping';
          else if (/(pln|pdam|electric| listrik |water|internet|indihome|first media|xl|telkomsel|telkom)/i.test(desc)) category = 'Bills & Utilities';
          else if (/(grab|gojek|transport|bus|train|travel|toll|tol|fuel|pertamina|spbu)/i.test(desc)) category = 'Transport';
          else if (/(hospital|clinic|apotek|pharmacy|doctor|dokter|bpjs)/i.test(desc)) category = 'Health & Fitness';
          else if (/(restaurant|cafe|coffee|mc ?donald|kfc|pizza|burger)/i.test(desc)) category = 'Food & Dining';
          else if (/(rent|sewa|kos| kontrakan |apartemen)/i.test(desc)) category = 'Housing';
          else if (/(education|tuition|school|kampus|course|kursus)/i.test(desc)) category = 'Other';
          else if (/(fee|biaya|admin|charges)/i.test(desc)) category = 'Financial Fees';
          else if (/(bca|bi-fast|trsf e-banking|transfer)/i.test(desc)) category = t.type === 'credit' ? 'Gifts & Transfers' : 'Other';
          else category = 'Other';
        }
        return { ...t, category };
      });

      return categorized;
    } catch (err) {
      console.error('Failed to categorize transactions:', err);
      return transactions; // Return original if categorization fails
    } finally {
      setIsCategorizing(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-h-[calc(100vh-8rem)] overflow-y-auto">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Import Bank Statement</h1>
        <p className="text-muted-foreground">Upload your BCA bank statement PDF to extract transactions</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Area */}
      <Card className="financial-card p-6">
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Upload PDF Statement</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select your BCA bank statement PDF file
            </p>
          </div>

           <div className="space-y-3">
             <Input
               type="file"
               accept=".pdf"
               onChange={handleFileChange}
               className="file:mr-4 file:pt-3 file:pb-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 text-center h-auto"
             />
            
            {preview && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{preview}</span>
                <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground text-center">
            <p>• Supported format: PDF only</p>
            <p>• Maximum file size: 10MB</p>
            <p>• Compatible with BCA bank statements</p>
          </div>
        </div>
      </Card>

      {/* Detected Transactions Review */}
      {detectedTransactions.length > 0 && (
        <Card className="financial-card p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Detected Transactions</h3>
              <span className="text-sm text-muted-foreground">
                {detectedTransactions.length} transaction{detectedTransactions.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="space-y-3 max-h-[32rem] overflow-y-auto">
              {detectedTransactions.map((transaction, index) => (
                <TransactionEditItem
                  key={index}
                  transaction={transaction}
                  index={index}
                  isEditing={editingTransaction === index.toString()}
                  onEdit={() => handleEditTransaction(index)}
                  onSave={handleSaveTransaction}
                  onDelete={() => handleDeleteTransaction(index)}
                  onCancel={handleCancelEdit}
                />
              ))}
            </div>

            <div className="flex gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isSaving}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveAllTransactions}
                disabled={isSaving || isCategorizing || detectedTransactions.length === 0}
                className="flex-1"
              >
                {isCategorizing ? 'Categorizing...' : isSaving ? 'Saving...' : `Save All (${detectedTransactions.length})`}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Instructions */}
      <Card className="financial-card p-4">
        <h4 className="font-semibold mb-3">How to get your BCA statement:</h4>
        <ol className="text-sm text-muted-foreground space-y-2">
          <li>1. Log in to your BCA mobile banking app</li>
          <li>2. Go to "Account Information" → "Account Statement"</li>
          <li>3. Select the date range you want to import</li>
          <li>4. Choose "Download PDF" option</li>
          <li>5. Upload the downloaded PDF file here</li>
        </ol>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isProcessing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          disabled={!file || isProcessing}
          className="flex-1"
        >
          {isProcessing ? 'Processing...' : 'Process PDF'}
        </Button>
      </div>
    </div>
  );
};

// Transaction Edit Item Component
interface TransactionEditItemProps {
  transaction: ImportedTransaction;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (index: number, transaction: ImportedTransaction) => void;
  onDelete: () => void;
  onCancel: () => void;
}

const TransactionEditItem = ({ 
  transaction, 
  index, 
  isEditing, 
  onEdit, 
  onSave, 
  onDelete, 
  onCancel 
}: TransactionEditItemProps) => {
  const [editData, setEditData] = useState<ImportedTransaction>(transaction);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const categories = [
    // Expense Categories
    "Food & Dining", "Transport", "Shopping", "Bills & Utilities", 
    "Housing", "Health & Fitness", "Entertainment & Leisure", "Financial Fees", "Other",
    // Income Categories
    "Salary / Wages", "Business Income", "Freelance / Side Hustle", 
    "Investments", "Gifts & Transfers"
  ];

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!editData.description.trim()) newErrors.description = "Description is required.";
    if (!editData.amount_cents || editData.amount_cents <= 0) newErrors.amount = "Amount must be positive.";
    if (!editData.category) newErrors.category = "Category is required.";
    if (!editData.date) newErrors.date = "Date is required.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave(index, editData);
  };

  const handleCancel = () => {
    setEditData(transaction);
    setErrors({});
    onCancel();
  };

  if (isEditing) {
    return (
      <Card className="p-4 border-2 border-primary/20">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                className="mt-1"
              />
              {errors.description && <p className="text-destructive text-xs mt-1">{errors.description}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                value={editData.amount_cents / 100}
                onChange={(e) => setEditData({ ...editData, amount_cents: parseFloat(e.target.value) * 100 })}
                className="mt-1"
              />
              {errors.amount && <p className="text-destructive text-xs mt-1">{errors.amount}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Type</label>
              <ToggleGroup
                type="single"
                value={editData.type}
                onValueChange={(value: "credit" | "debit") => setEditData({ ...editData, type: value })}
                className="mt-1"
              >
                <ToggleGroupItem value="credit">Income</ToggleGroupItem>
                <ToggleGroupItem value="debit">Expense</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select value={editData.category || ""} onValueChange={(value) => setEditData({ ...editData, category: value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-destructive text-xs mt-1">{errors.category}</p>}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              value={editData.date}
              onChange={(e) => setEditData({ ...editData, date: e.target.value })}
              className="mt-1"
            />
            {errors.date && <p className="text-destructive text-xs mt-1">{errors.date}</p>}
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel} className="flex-1">
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-1 rounded-full ${
              transaction.type === 'credit' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {transaction.type === 'credit' ? 'Income' : 'Expense'}
            </span>
            <span className="text-xs text-muted-foreground">{transaction.category || 'Other'}</span>
          </div>
          <p className="font-medium text-sm truncate">{transaction.description}</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              {new Date(transaction.date).toLocaleDateString()}
            </span>
            <MoneyDisplay 
              amount={transaction.amount_cents} 
              showSign 
              size="sm" 
              animate={false}
            />
          </div>
        </div>
        <div className="flex gap-1 ml-2">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
