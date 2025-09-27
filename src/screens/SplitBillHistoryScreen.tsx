import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { useFinancifyStore, type SplitBillHistory } from "@/store";
import { History, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const SplitBillHistoryScreen = ({ onBack }: { onBack: () => void }) => {
  const { splitBillHistory, loadSplitBillHistory, updatePaymentStatus, removeSplitBill } = useFinancifyStore();
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [selectedBill, setSelectedBill] = useState<SplitBillHistory | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState<boolean>(false);
  const [lastToggle, setLastToggle] = useState<{ billId: string; personId: string } | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [animationDirection, setAnimationDirection] = useState<'enter' | 'exit' | null>(null);

  // Best-effort refresh
  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useEffect(() => { 
    console.log('SplitBillHistoryScreen: Loading history...');
    loadSplitBillHistory(); 
  }, [loadSplitBillHistory]);
  
  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useEffect(() => {
    console.log('SplitBillHistoryScreen: Current history state:', splitBillHistory);
  }, [splitBillHistory]);

  const getInitials = (name: string) => name.split(" ").map(s => s[0]).join("").slice(0,2).toUpperCase();

  const handlePaymentToggle = (billId: string, personId: string, hasPaid: boolean) => {
    if (selectedBill && selectedBill.id === billId) {
      const updatedPaymentStatus = {
        ...selectedBill.payment_status,
        [personId]: hasPaid
      };
      
      // Check if all participants will be paid after this change
      const allPaid = selectedBill.people.every(person => 
        person.id === personId ? hasPaid : ((selectedBill.payment_status || {})[person.id] || false)
      );
      
      // If all participants are now paid, ask for confirmation instead of removing immediately
      if (allPaid && hasPaid) {
        setLastToggle({ billId, personId });
        setShowCompleteConfirm(true);
      }
      
      // Update the selectedBill state to reflect the change immediately
      setSelectedBill({
        ...selectedBill,
        payment_status: updatedPaymentStatus
      });
    }
    
    updatePaymentStatus(billId, personId, hasPaid);
  };

  // Handle swipe animations
  const handleViewSummary = (bill: SplitBillHistory) => {
    if (isAnimating) return; // Prevent multiple animations
    setIsAnimating(true);
    setAnimationDirection('exit');
    setTimeout(() => {
      setSelectedBill(bill);
      setShowSummary(true);
      // Use requestAnimationFrame to ensure DOM update before applying enter animation
      requestAnimationFrame(() => {
        setAnimationDirection('enter');
        setTimeout(() => {
          setIsAnimating(false);
          setAnimationDirection(null);
        }, 300); // Match CSS animation duration exactly
      });
    }, 300); // Match CSS animation duration exactly
  };

  const handleBackToList = () => {
    if (isAnimating) return; // Prevent multiple animations
    setIsAnimating(true);
    setAnimationDirection('exit');
    setTimeout(() => {
      setShowSummary(false);
      setSelectedBill(null);
      // Use requestAnimationFrame to ensure DOM update before applying enter animation
      requestAnimationFrame(() => {
        setAnimationDirection('enter');
        setTimeout(() => {
          setIsAnimating(false);
          setAnimationDirection(null);
        }, 300); // Match CSS animation duration exactly
      });
    }, 300); // Match CSS animation duration exactly
  };

  // Cleanup animation state on unmount
  React.useEffect(() => {
    return () => {
      setIsAnimating(false);
      setAnimationDirection(null);
    };
  }, []);

  if (showSummary && selectedBill) {
    return (
      <div className={`space-y-6 ${isAnimating && animationDirection === 'exit' ? 'history-swipe-exit' : 'history-swipe-enter'}`}>
        <div className="flex items-center justify-between w-full px-0 py-4">
          <h2 className="text-xl font-semibold">Split Bill Summary</h2>
          <Button 
            variant="ghost" 
            onClick={handleBackToList} 
            className="flex items-center gap-2 px-4 py-2"
          >
            <ArrowLeft className="w-4 h-4" /> 
            Back
          </Button>
        </div>

        <Card className="financial-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">{new Date(selectedBill.date).toLocaleDateString()}</h3>
              <p className="text-sm text-muted-foreground">
                {selectedBill.people.length} people • {selectedBill.items.length} items
              </p>
            </div>
            <MoneyDisplay amount={selectedBill.total_amount_cents} size="xl" />
          </div>

          {/* Items List */}
          <div className="space-y-3 mb-6">
            <h4 className="font-medium text-muted-foreground">Items</h4>
            {selectedBill.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.participants.length} participant{item.participants.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <MoneyDisplay amount={item.price_cents} size="md" />
              </div>
            ))}
          </div>

          {/* Payment Status */}
          <div className="space-y-3">
            <h4 className="font-medium text-muted-foreground">Payment Status</h4>
            {selectedBill.people.map((person) => {
              const hasPaid = (selectedBill.payment_status || {})[person.id] || false;
              const personTotal = selectedBill.person_totals[person.id]?.total_cents || 0;
              
              return (
                <div 
                  key={person.id} 
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all duration-300 ease-in-out ${
                    hasPaid
                      ? 'bg-primary text-primary-foreground border-primary shadow-md'
                      : 'bg-muted border-border/50 hover:shadow-[var(--shadow-float)]'
                  }`}
                  onClick={() => handlePaymentToggle(selectedBill.id, person.id, !hasPaid)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      handlePaymentToggle(selectedBill.id, person.id, !hasPaid);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-sm">{getInitials(person.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{person.name}</p>
                      <p className={`text-sm transition-colors duration-300 ease-in-out ${hasPaid ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {hasPaid ? 'Paid' : 'Pending'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MoneyDisplay amount={personTotal} size="md" />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Completion confirmation dialog */}
        <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>All participants marked as paid</AlertDialogTitle>
              <AlertDialogDescription>
                Do you want to finish this split bill? You can undo the last check if it was accidental.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  // Undo last toggle
                  if (lastToggle) {
                    updatePaymentStatus(lastToggle.billId, lastToggle.personId, false);
                    if (selectedBill) {
                      setSelectedBill({
                        ...selectedBill,
                        payment_status: {
                          ...selectedBill.payment_status,
                          [lastToggle.personId]: false,
                        },
                      });
                    }
                  }
                  setShowCompleteConfirm(false);
                  setLastToggle(null);
                }}
              >
                Undo
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedBill) {
                    removeSplitBill(selectedBill.id);
                  }
                  setShowCompleteConfirm(false);
                  setLastToggle(null);
                  setShowSummary(false);
                  setSelectedBill(null);
                }}
              >
                Finish
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${isAnimating && animationDirection === 'exit' ? 'split-swipe-exit' : 'split-swipe-enter'}`}>
      <div className="flex items-center justify-between w-full px-0 py-4">
        <h2 className="text-xl font-semibold">Active Split Bill</h2>
        <Button 
          variant="ghost" 
          onClick={onBack} 
          className="flex items-center gap-2 px-4 py-2"
        >
          <ArrowLeft className="w-4 h-4" /> 
          Back
        </Button>
      </div>

      {splitBillHistory.length === 0 ? (
        <Card className="financial-card p-8 text-center">
          <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No active split bills yet</p>
          <p className="text-sm text-muted-foreground">Start splitting bills to see them here</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {splitBillHistory.map((history) => {
            const paidCount = Object.values(history.payment_status || {}).filter(Boolean).length;
            const totalCount = history.people.length;
            
            return (
              <Card key={history.id} className="financial-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-lg">{new Date(history.date).toLocaleDateString()}</h4>
                    <p className="text-sm text-muted-foreground">
                      {history.people.length} people • {history.items.length} items
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {paidCount}/{totalCount} paid
                    </p>
                  </div>
                  <div className="text-right">
                    <MoneyDisplay amount={history.total_amount_cents} size="lg" />
                  </div>
                </div>


                <div className="mt-4 pt-3 border-t">
                  <Button 
                    onClick={() => handleViewSummary(history)}
                    className="w-full"
                    variant="outline"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Summary & Payment Status
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};


