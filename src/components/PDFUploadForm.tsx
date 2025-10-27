import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Upload, FileText, AlertCircle, CheckCircle, Edit2, Trash2, DollarSign, Tag, Calendar } from "lucide-react";
import { useFinancifyStore } from "@/store";
import { toast } from "@/components/ui/use-toast";
import { parseBcaStatementPdf } from "@/lib/bca-pdf-parser";
import { categorizeTransactionsWithAI } from "@/lib/ai-categorizer";
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
  const [editingTransactionIndex, setEditingTransactionIndex] = useState<number | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState<ImportedTransaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [transactionToDeleteIndex, setTransactionToDeleteIndex] = useState<number | null>(null);

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

      // Automatically categorize transactions using AI
      setIsCategorizing(true);
      const categorizedTransactions = await categorizeTransactions(transactions);
      setIsCategorizing(false);
      
      // Show detected and categorized transactions for review
      setDetectedTransactions(categorizedTransactions);
      
      toast({
        title: "PDF Processed & Categorized",
        description: `Found ${categorizedTransactions.length} transactions and automatically categorized them. Review and edit if needed.`,
      });
    } catch (error) {
      setError('Failed to process PDF. Please make sure it\'s a valid BCA bank statement.');
    } finally {
      setIsProcessing(false);
      setIsCategorizing(false);
    }
  };

  const handleEditTransaction = (index: number) => {
    setEditingTransactionIndex(index);
    setEditData(detectedTransactions[index]);
    setEditDialogOpen(true);
  };

  const handleSaveEditedTransaction = () => {
    if (!editData || editingTransactionIndex === null) return;
    
    // Validate
    if (!editData.description.trim() || !editData.amount_cents || !editData.category) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }
    
    setDetectedTransactions(prev => 
      prev.map((t, i) => i === editingTransactionIndex ? editData : t)
    );
    
    setEditDialogOpen(false);
    setEditingTransactionIndex(null);
    setEditData(null);
    
    toast({
      title: "Transaction Updated",
      description: "Transaction has been successfully updated.",
    });
  };

  const handleDeleteTransaction = (index: number) => {
    setTransactionToDeleteIndex(index);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteTransaction = () => {
    if (transactionToDeleteIndex !== null) {
      setDetectedTransactions(prev => prev.filter((_, i) => i !== transactionToDeleteIndex));
      toast({
        title: "Transaction Deleted",
        description: "Transaction has been successfully deleted.",
      });
    }
    setIsDeleteConfirmOpen(false);
    setTransactionToDeleteIndex(null);
  };

  const handleSaveAllTransactions = async () => {
    if (detectedTransactions.length === 0) {
      setError('No transactions to save.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Save the transactions (already categorized during upload)
      await saveTransactions(detectedTransactions);
      setImportedDraft([]);
      
      toast({
        title: "Transactions Saved",
        description: `${detectedTransactions.length} transactions have been saved successfully.`,
      });

      // Close the form
      onClose();
    } catch (error) {
      setError('Failed to save transactions. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    setEditingTransactionIndex(null);
    setEditData(null);
  };

  // Category options
  const expenseCategories = [
    { value: "Food & Dining", label: "Food & Dining", icon: "🍽️" },
    { value: "Transport", label: "Transport", icon: "🚗" },
    { value: "Shopping", label: "Shopping", icon: "🛍️" },
    { value: "Bills & Utilities", label: "Bills & Utilities", icon: "⚡" },
    { value: "Housing", label: "Housing", icon: "🏠" },
    { value: "Health & Fitness", label: "Health & Fitness", icon: "💪" },
    { value: "Entertainment & Leisure", label: "Entertainment & Leisure", icon: "🎬" },
    { value: "Financial Fees", label: "Financial Fees", icon: "💳" },
    { value: "Virtual Account", label: "Virtual Account", icon: "💸" },
    { value: "Other", label: "Other", icon: "📦" }
  ];

  const incomeCategories = [
    { value: "Salary / Wages", label: "Salary / Wages", icon: "💰" },
    { value: "Business Income", label: "Business Income", icon: "💼" },
    { value: "Freelance / Side Hustle", label: "Freelance / Side Hustle", icon: "🆓" },
    { value: "Investments", label: "Investments", icon: "📈" },
    { value: "Gifts & Transfers", label: "Gifts & Transfers", icon: "🎁" }
  ];

  const categoryOptions = editData ? (editData.type === 'credit' ? incomeCategories : expenseCategories) : expenseCategories;

  // Clear category when type changes if it's not valid for the new type
  const handleTypeChange = (newType: 'credit' | 'debit') => {
    if (!editData) return;
    
    const newCategoryOptions = newType === 'credit' ? incomeCategories : expenseCategories;
    const isCategoryValid = newCategoryOptions.some(cat => cat.value === editData.category);
    
    setEditData({
      ...editData,
      type: newType,
      category: isCategoryValid ? editData.category : ''
    });
  };

  const categorizeTransactions = async (transactions: ImportedTransaction[]): Promise<ImportedTransaction[]> => {
    setIsCategorizing(true);
    
    try {
      // Use OpenAI for intelligent categorization
      const categorized = await categorizeTransactionsWithAI(transactions);
      return categorized;
    } catch (err) {
      toast({
        title: "Categorization Warning",
        description: "Some transactions may not be properly categorized. You can edit them manually.",
        variant: "default"
      });
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
          {/* Loading Screen */}
          {(isProcessing || isCategorizing) && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-primary/40 rounded-full animate-pulse"></div>
              </div>
              <div className="text-center space-y-2 mt-6">
                <p className="text-lg font-semibold text-primary">
                  {isCategorizing ? 'Categorizing Transactions' : 'Processing PDF'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isCategorizing ? 'Using AI to categorize your transactions...' : 'Extracting transaction data...'}
                </p>
                <div className="flex items-center justify-center space-x-1 mt-3">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* Upload Form */}
          {!isProcessing && !isCategorizing && (
            <>
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
            <p>• Recommended for BCA mobile instead of MyBCA</p>
          </div>
            </>
          )}
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
            
            <div className="space-y-3 max-h-[32rem] overflow-y-auto overflow-x-hidden">
              {detectedTransactions.map((transaction, index) => (
                <TransactionEditItem
                  key={index}
                  transaction={transaction}
                  index={index}
                  isEditing={false}
                  onEdit={() => handleEditTransaction(index)}
                  onSave={() => {}}
                  onDelete={() => handleDeleteTransaction(index)}
                  onCancel={() => {}}
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
                disabled={isSaving || detectedTransactions.length === 0}
                className="flex-1"
              >
                {isSaving ? 'Saving...' : `Save All (${detectedTransactions.length})`}
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
          disabled={!file || isProcessing || isCategorizing}
          className="flex-1"
        >
          {isProcessing || isCategorizing ? (isCategorizing ? 'Categorizing...' : 'Processing...') : 'Process PDF'}
        </Button>
      </div>

      {/* Edit Transaction Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent className="max-w-md mx-auto rounded-3xl">
          <DialogHeader className="rounded-t-3xl">
            <DialogTitle className="text-xl font-bold">Edit Transaction</DialogTitle>
          </DialogHeader>
          
          {editData && (
            <div className="space-y-4">
              {/* Description */}
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  placeholder="Enter description"
                  required
                  className="pl-10 rounded-2xl h-12 text-base"
                  autoComplete="off"
                />
              </div>

              {/* Amount and Type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    type="number"
                    value={Math.abs(editData.amount_cents)}
                    onChange={(e) => setEditData({ ...editData, amount_cents: parseFloat(e.target.value || '0') })}
                    placeholder="0"
                    required
                    className="pl-10 rounded-2xl h-12 text-base"
                    inputMode="decimal"
                  />
                </div>
                <ToggleGroup
                  type="single"
                  value={editData.type}
                  onValueChange={(value: 'credit' | 'debit') => value && handleTypeChange(value)}
                  className="justify-stretch"
                >
                  <ToggleGroupItem value="credit" className="flex-1 rounded-2xl h-12 data-[state=on]:bg-green-500 data-[state=on]:text-white">
                    Income
                  </ToggleGroupItem>
                  <ToggleGroupItem value="debit" className="flex-1 rounded-2xl h-12 data-[state=on]:bg-red-500 data-[state=on]:text-white">
                    Expense
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Category and Date */}
              <div className="grid grid-cols-2 gap-3">
                {/* Category */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Tag className="w-4 h-4" />
                    <span>Category</span>
                  </div>
                  <SearchableSelect
                    value={editData.category || ''}
                    onValueChange={(value) => setEditData({ ...editData, category: value })}
                    options={categoryOptions}
                    placeholder="Select category"
                    className="rounded-2xl h-12"
                  />
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>Date</span>
                  </div>
                  <Input
                    type="date"
                    value={editData.date}
                    onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                    required
                    className="rounded-2xl h-12 text-base"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                  className="flex-1 rounded-2xl h-12"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveEditedTransaction}
                  className="flex-1 rounded-2xl h-12 bg-gradient-to-r from-primary to-primary-light"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete this transaction? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 rounded-full"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeleteTransaction}
                className="flex-1 rounded-full bg-red-500 text-white hover:bg-red-600"
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
  return (
    <div className="w-full flex items-center gap-2">
      {/* Main Card */}
      <Card className="flex-1 min-w-0 p-3 overflow-hidden">
        <div className="w-full flex items-center gap-3">
          {/* Left side - Description and metadata */}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{transaction.description}</p>
            <div className="flex items-center gap-2 mt-1 overflow-hidden">
              <span className="text-sm text-muted-foreground truncate">{transaction.category || 'Other'}</span>
              <span className="text-sm text-muted-foreground flex-shrink-0">•</span>
              <span className="text-sm text-muted-foreground flex-shrink-0">
                {new Date(transaction.date).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          {/* Right side - Amount */}
          <div className="flex-shrink-0 w-24">
            <div className="text-right">
              <p className={`font-bold ${
                transaction.type === 'credit' ? 'text-income' : 'text-expense'
              }`}>
                {new Intl.NumberFormat('id-ID', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(Math.abs(transaction.amount_cents))}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Edit/Delete icons outside the card */}
      <div className="flex flex-col gap-1 flex-shrink-0">
        {/* Edit Icon */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="h-8 w-8 rounded-md bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 dark:text-yellow-400"
          aria-label="Edit transaction"
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        {/* Delete Icon */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 rounded-md bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400"
          aria-label="Delete transaction"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
