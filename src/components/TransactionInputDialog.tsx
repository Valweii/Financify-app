import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { MoneyDisplay } from "./MoneyDisplay";
import { useFinancifyStore } from "@/store";
import { toast } from "@/components/ui/use-toast";

interface TransactionInputDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TransactionInputDialog = ({ isOpen, onClose }: TransactionInputDialogProps) => {
  const { createTransaction } = useFinancifyStore();
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'debit' as 'credit' | 'debit',
    category: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Detect mobile device and keyboard
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    const handleResize = () => {
      checkMobile();
      // Detect virtual keyboard on mobile
      if (window.innerHeight < window.screen.height * 0.75) {
        setKeyboardHeight(window.screen.height - window.innerHeight);
      } else {
        setKeyboardHeight(0);
      }
    };

    checkMobile();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !formData.category) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const amountCents = Math.round(parseFloat(formData.amount));
      const finalAmount = formData.type === 'credit' ? amountCents : -amountCents;
      
      await createTransaction({
        description: formData.description,
        amount_cents: finalAmount,
        type: formData.type,
        category: formData.category,
        date: formData.date
      });

      toast({
        title: "Transaction Added",
        description: "Your transaction has been successfully added.",
      });

      // Reset form
      setFormData({
        description: '',
        amount: '',
        type: 'debit',
        category: '',
        date: new Date().toISOString().split('T')[0]
      });
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add transaction. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className={`max-w-md mx-auto rounded-3xl ${
          isMobile && keyboardHeight > 0 
            ? 'fixed bottom-0 left-1/2 transform -translate-x-1/2 mb-4 max-h-[calc(100vh-2rem)] overflow-y-auto' 
            : ''
        }`}
        style={isMobile && keyboardHeight > 0 ? { 
          marginBottom: `${Math.max(keyboardHeight - 20, 0)}px`,
          transition: 'margin-bottom 0.3s ease-in-out'
        } : {}}
      >
        <DialogHeader className="rounded-t-3xl">
          <DialogTitle className="text-xl font-bold">Add New Transaction</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter transaction description"
              required
              className="rounded-2xl h-12 text-base"
              autoComplete="off"
            />
          </div>

          {/* Amount and Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                required
                className="rounded-2xl h-12 text-base"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: 'credit' | 'debit') => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger className="rounded-2xl h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Income</SelectItem>
                  <SelectItem value="debit">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger className="rounded-2xl h-12">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Food & Dining">Food & Dining</SelectItem>
                <SelectItem value="Transportation">Transportation</SelectItem>
                <SelectItem value="Shopping">Shopping</SelectItem>
                <SelectItem value="Entertainment">Entertainment</SelectItem>
                <SelectItem value="Bills & Utilities">Bills & Utilities</SelectItem>
                <SelectItem value="Healthcare">Healthcare</SelectItem>
                <SelectItem value="Education">Education</SelectItem>
                <SelectItem value="Travel">Travel</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              required
              className="rounded-2xl h-12 text-base"
            />
          </div>

          {/* Preview */}
          {formData.amount && (
            <Card className="p-4 bg-muted/50 rounded-2xl border-0 shadow-sm">
              <div className="text-sm text-muted-foreground mb-2">Preview:</div>
              <div className="flex items-center justify-between">
                <span className="font-medium">{formData.description || 'Transaction'}</span>
                <MoneyDisplay 
                  amount={formData.type === 'credit' ? parseFloat(formData.amount) : -parseFloat(formData.amount)}
                  showSign
                  size="sm"
                />
              </div>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 pb-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 rounded-2xl h-12 font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-2xl h-12 font-semibold bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? 'Adding...' : 'Add Transaction'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
