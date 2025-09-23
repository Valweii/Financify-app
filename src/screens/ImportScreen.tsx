import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFinancifyStore, ImportedTransaction } from "@/store";
import { Upload, FileText, Wand2, Plus, AlertCircle } from "lucide-react";
import { useState, useRef } from "react";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { parseBcaStatementPdf } from "@/lib/bca-pdf-parser";

export const ImportScreen = () => {
  const { importedDraft, setImportedDraft, clearImportedDraft, saveTransactions } = useFinancifyStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Removed mock data; we now parse the uploaded BCA PDF

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const transactions = await parseBcaStatementPdf(file);
      if (!transactions || transactions.length === 0) {
        setError('No transactions found. Please ensure the PDF is a BCA statement.');
        return;
      }
      setImportedDraft(transactions);
    } catch (err) {
      setError('Failed to process PDF. Please ensure it\'s a valid bank statement.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCategorize = async () => {
    if (importedDraft.length === 0) return;

    setIsCategorizing(true);
    
    try {
      // Simple deterministic categorizer based on keywords
      const categorized = importedDraft.map(t => {
        const desc = t.description.toLowerCase();
        let category = t.category;
        if (!category) {
          if (/(salary|gaji|payroll|transfer.*(gaji|salary))/i.test(desc)) category = 'Income';
          else if (/(indomaret|alfamart|supermarket|mini market|grocer|hypermart)/i.test(desc)) category = 'Food & Drinks';
          else if (/(tokopedia|shopee|lazada|blibli|ecommerce|marketplace)/i.test(desc)) category = 'Shopping';
          else if (/(pln|pdam|electric| listrik |water|internet|indihome|first media|xl|telkomsel|telkom)/i.test(desc)) category = 'Bills & Utilities';
          else if (/(grab|gojek|transport|bus|train|travel|toll|tol|fuel|pertamina|spbu)/i.test(desc)) category = 'Transport';
          else if (/(hospital|clinic|apotek|pharmacy|doctor|dokter|bpjs)/i.test(desc)) category = 'Health';
          else if (/(restaurant|cafe|coffee|mc ?donald|kfc|pizza|burger)/i.test(desc)) category = 'Food & Drinks';
          else if (/(rent|sewa|kos| kontrakan |apartemen)/i.test(desc)) category = 'Housing';
          else if (/(education|tuition|school|kampus|course|kursus)/i.test(desc)) category = 'Education';
          else if (/(fee|biaya|admin|charges)/i.test(desc)) category = 'Fees';
          else if (/(bca|bi-fast|trsf e-banking|transfer)/i.test(desc)) category = t.type === 'credit' ? 'Income' : 'Transfer';
          else category = 'Other';
        }
        return { ...t, category };
      });

      setImportedDraft(categorized);
    } catch (err) {
      setError('Failed to categorize transactions');
    } finally {
      setIsCategorizing(false);
    }
  };

  const handleAddToLedger = async () => {
    if (importedDraft.length === 0) return;
    
    try {
      await saveTransactions(importedDraft);
      clearImportedDraft();
      toast({
        title: "Transactions Added",
        description: `${importedDraft.length} transactions have been added to your ledger.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save transactions. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Import Bank Statement</h1>
        <p className="text-muted-foreground">Upload your bank PDF to extract transactions</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Section */}
      <Card className="financial-card p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold">Bank Mutation PDF Input</h3>
            <p className="text-sm text-muted-foreground">
              Upload your bank statement PDF to automatically extract transactions
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
          />

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="btn-primary px-6 py-3"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                Processing PDF...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload PDF
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Preview Section */}
      {importedDraft.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Preview Transactions</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCategorize}
                disabled={isCategorizing}
                size="sm"
              >
                {isCategorizing ? (
                  <>
                    <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2" />
                    Categorizing...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-1" />
                    AI Categorize
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleAddToLedger}
                className="btn-primary"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add to Ledger
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {importedDraft.map((transaction, index) => (
              <Card key={index} className="financial-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{transaction.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-muted-foreground">
                        {new Date(transaction.date).toLocaleDateString('id-ID')}
                      </p>
                      {transaction.category && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                            {transaction.category}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <MoneyDisplay 
                    amount={transaction.type === 'credit' ? transaction.amount_cents : -transaction.amount_cents}
                    showSign
                    size="md"
                  />
                </div>
              </Card>
            ))}
          </div>

          <div className="bg-muted/50 rounded-xl p-4">
            <div className="flex justify-between text-sm">
              <span>Total Transactions:</span>
              <span className="font-semibold">{importedDraft.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};