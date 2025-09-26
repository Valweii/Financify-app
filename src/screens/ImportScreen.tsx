import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinancifyStore, ImportedTransaction } from "@/store";
import { Upload, FileText, Wand2, Plus, AlertCircle, Edit2, Check, X } from "lucide-react";
import { useState, useRef } from "react";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { parseBcaStatementPdf } from "@/lib/bca-pdf-parser";

export const ImportScreen = () => {
  const { user, importedDraft, setImportedDraft, clearImportedDraft, saveTransactions, createTransaction } = useFinancifyStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<ImportedTransaction>>({});
  const [editAmount, setEditAmount] = useState<string>("0");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isEmailConfirmed = Boolean((user as any)?.email_confirmed_at);

  // Manual Add Transaction form (moved from Reports -> All)
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<ImportedTransaction & { date: string }>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    type: 'debit',
    amount_cents: 0,
    category: 'Other',
  });

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

  const startEdit = (index: number, transaction: ImportedTransaction) => {
    setEditingIndex(index);
    // Convert ISO date to YYYY-MM-DD format for HTML date input
    const dateForInput = transaction.date ? transaction.date.split('T')[0] : '';
    setEditForm({
      date: dateForInput,
      description: transaction.description,
      type: transaction.type,
      amount_cents: transaction.amount_cents,
      category: transaction.category,
    });
    setEditAmount(transaction.amount_cents.toString());
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditForm({});
    setEditAmount("0");
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    
    const updatedTransactions = [...importedDraft];
    // Convert date back to ISO format if it was changed
    const updatedForm = {
      ...editForm,
      date: editForm.date ? new Date(editForm.date).toISOString() : updatedTransactions[editingIndex].date,
      amount_cents: Math.max(0, parseInt(editAmount || '0', 10)),
    };
    
    updatedTransactions[editingIndex] = {
      ...updatedTransactions[editingIndex],
      ...updatedForm,
    };
    
    setImportedDraft(updatedTransactions);
    setEditingIndex(null);
    setEditForm({});
    setEditAmount("0");
    
    toast({
      title: "Transaction Updated",
      description: "Transaction has been updated successfully.",
    });
  };

  const deleteTransaction = (index: number) => {
    const updatedTransactions = importedDraft.filter((_, i) => i !== index);
    setImportedDraft(updatedTransactions);
    
    toast({
      title: "Transaction Deleted",
      description: "Transaction has been removed from the import.",
    });
  };

  // If email not confirmed, show alert and hide add/import features
  if (!isEmailConfirmed) {
    return (
      <div className="space-y-6 pb-20">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Add Transactions</h1>
          <p className="text-muted-foreground">Confirm your email to start adding transactions</p>
        </div>
        <Card className="financial-card p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold">Email confirmation required</h3>
              <p className="text-sm text-muted-foreground mt-1">
                We’ve sent a confirmation link to your email. Please confirm to enable adding transactions. You can still browse other tabs.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

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

      {/* Add Transaction (manual) */}
      <Card className="financial-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Quick Add Transaction</h3>
          <Button size="sm" className="btn-primary" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Transaction
          </Button>
        </div>
        {isAddOpen && (
          <div className="grid gap-3 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">Date</label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Income/Expense</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as 'debit' | 'credit' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Income</SelectItem>
                    <SelectItem value="debit">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Description</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">Amount (IDR)</label>
                <Input
                  type="number"
                  min={0}
                  value={form.amount_cents}
                  onChange={(e) => setForm({ ...form, amount_cents: Math.max(0, parseInt(e.target.value || '0', 10)) })}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Category</label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Income','Food & Drinks','Shopping','Bills & Utilities','Transport','Health','Housing','Education','Fees','Transfer','Other'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                className="btn-primary"
                size="sm"
                onClick={async () => {
                  const trimmedDescription = (form.description || '').trim();
                  const trimmedCategory = (form.category || '').trim();
                  const isValidDate = Boolean(form.date);
                  const isValidType = form.type === 'debit' || form.type === 'credit';
                  const isValidAmount = Number.isFinite(form.amount_cents) && form.amount_cents > 0;
                  const isValidCategory = trimmedCategory.length > 0;
                  const isValidDescription = trimmedDescription.length > 0;
                  if (!isValidDate || !isValidType || !isValidAmount || !isValidCategory || !isValidDescription) return;
                  await createTransaction({ ...form, description: trimmedDescription, category: trimmedCategory });
                  setIsAddOpen(false);
                  setForm({ date: new Date().toISOString().split('T')[0], description: '', type: 'debit', amount_cents: 0, category: 'Other' });
                }}
              >
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </Card>

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
                {editingIndex === index ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Date</label>
                        <Input
                          type="date"
                          value={editForm.date || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Type</label>
                        <Select
                          value={editForm.type || 'debit'}
                          onValueChange={(value: 'debit' | 'credit') => setEditForm(prev => ({ ...prev, type: value }))}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="debit">Debit (Expense)</SelectItem>
                            <SelectItem value="credit">Credit (Income)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Description</label>
                      <Input
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                        className="mt-1"
                        placeholder="Transaction description"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Amount (IDR)</label>
                        <Input
                          type="number"
                          min={0}
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="mt-1"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Category</label>
                        <Select
                          value={editForm.category || 'none'}
                          onValueChange={(value) => setEditForm(prev => ({ ...prev, category: value === 'none' ? undefined : value }))}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Category</SelectItem>
                            <SelectItem value="Income">Income</SelectItem>
                            <SelectItem value="Food & Drinks">Food & Drinks</SelectItem>
                            <SelectItem value="Shopping">Shopping</SelectItem>
                            <SelectItem value="Bills & Utilities">Bills & Utilities</SelectItem>
                            <SelectItem value="Transport">Transport</SelectItem>
                            <SelectItem value="Health">Health</SelectItem>
                            <SelectItem value="Housing">Housing</SelectItem>
                            <SelectItem value="Education">Education</SelectItem>
                            <SelectItem value="Fees">Fees</SelectItem>
                            <SelectItem value="Transfer">Transfer</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button onClick={saveEdit} size="sm" className="btn-primary">
                        <Check className="w-4 h-4 mr-1" />
                        Save
                      </Button>
                      <Button onClick={cancelEdit} variant="outline" size="sm">
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Mode
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
                    <div className="flex items-center gap-2">
                      <MoneyDisplay 
                        amount={transaction.type === 'credit' ? transaction.amount_cents : -transaction.amount_cents}
                        showSign
                        size="md"
                        animate={false}
                      />
                      <div className="flex gap-1">
                        <Button
                          onClick={() => startEdit(index, transaction)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => deleteTransaction(index)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
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