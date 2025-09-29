import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MoneyDisplay } from "./MoneyDisplay";
import { useFinancifyStore } from "@/store";
import { toast } from "@/components/ui/use-toast";
import { DollarSign, FileText, Calendar, Tag } from "lucide-react";

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

  // Category options with icons
  const categoryOptions = [
    // Expense Categories
    { value: "Food & Dining", label: "Food & Dining", icon: "🍽️" },
    { value: "Transport", label: "Transport", icon: "🚗" },
    { value: "Shopping", label: "Shopping", icon: "🛍️" },
    { value: "Bills & Utilities", label: "Bills & Utilities", icon: "⚡" },
    { value: "Housing", label: "Housing", icon: "🏠" },
    { value: "Health & Fitness", label: "Health & Fitness", icon: "💪" },
    { value: "Entertainment & Leisure", label: "Entertainment & Leisure", icon: "🎬" },
    { value: "Financial Fees", label: "Financial Fees", icon: "💳" },
    { value: "Other", label: "Other", icon: "📦" },
    // Income Categories
    { value: "Salary / Wages", label: "Salary / Wages", icon: "💰" },
    { value: "Business Income", label: "Business Income", icon: "💼" },
    { value: "Freelance / Side Hustle", label: "Freelance / Side Hustle", icon: "🆓" },
    { value: "Investments", label: "Investments", icon: "📈" },
    { value: "Gifts & Transfers", label: "Gifts & Transfers", icon: "🎁" }
  ];

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
          <div className="relative">
            <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
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
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                required
                className="pl-10 rounded-2xl h-12 text-base"
                inputMode="decimal"
              />
            </div>
            <ToggleGroup
              type="single"
              value={formData.type}
              onValueChange={(value: 'credit' | 'debit') => value && setFormData(prev => ({ ...prev, type: value }))}
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

          {/* Category and Date - Inline */}
          <div className="grid grid-cols-2 gap-3">
            {/* Category */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tag className="w-4 h-4" />
                Category
              </div>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger className="rounded-2xl h-12">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      <div className="flex items-center gap-2">
                        <span>{category.icon}</span>
                        <span>{category.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                Date
              </div>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                required
                className="rounded-2xl h-12 text-base"
              />
            </div>
          </div>

          {/* Preview */}
          {formData.amount && (
            <Card className="p-3 bg-muted/50 rounded-2xl border-0 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{formData.description || 'Transaction'}</span>
                <MoneyDisplay 
                  amount={formData.type === 'credit' ? parseFloat(formData.amount) : -parseFloat(formData.amount)}
                  showSign
                  size="sm"
                />
              </div>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
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
              {isSubmitting ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
