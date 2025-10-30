import { useMemo, useState, useEffect, useCallback } from "react";
import { useFinancifyStore, type SplitBillHistory } from "@/store";
import { toast } from "@/components/ui/use-toast";
import { parseReceiptImage } from "@/lib/receipt-ocr";
import { useNavigate } from "react-router-dom";
import { Person, Item, PersonTotals } from "@/types/split-bill";
import { SplitBillListScreen } from "./split-bill/SplitBillListScreen";
import { UploadReceiptScreen } from "./split-bill/UploadReceiptScreen";
import { AddPeopleScreen } from "./split-bill/AddPeopleScreen";
import { AssignItemsScreen } from "./split-bill/AssignItemsScreen";
import { ReviewSplitBillScreen } from "./split-bill/ReviewSplitBillScreen";
import { SplitBillDetailModal } from "./split-bill/SplitBillDetailModal";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const SplitBillScreen = ({ 
  onReset, 
  isActive, 
  onNavigate, 
  startAtStep = -1 
}: { 
  onReset?: (resetFn: () => void) => void; 
  isActive?: boolean; 
  onNavigate?: () => void; 
  startAtStep?: number 
}) => {
  const { 
    createTransaction, 
    user, 
    profile, 
    saveSplitBillHistory, 
    splitBillHistory, 
    loadSplitBillHistory, 
    updatePaymentStatus, 
    removeSplitBill 
  } = useFinancifyStore();
  
  const navigate = useNavigate();

  // State management
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [taxServicePercent, setTaxServicePercent] = useState<number>(0);
  const [step, setStep] = useState<-1 | 0 | 1 | 2 | 3>(startAtStep as -1 | 0 | 1 | 2 | 3);
  const [assignPersonId, setAssignPersonId] = useState<string | null>(null);
  const [myPersonId, setMyPersonId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>("");
  const [progressAnimation, setProgressAnimation] = useState<'forward' | 'backward' | null>(null);
  const [progressFrom, setProgressFrom] = useState<number>(0);
  const [progressTo, setProgressTo] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // State for viewing split bill details
  const [showSplitBillDetail, setShowSplitBillDetail] = useState<boolean>(false);
  const [selectedSplitBill, setSelectedSplitBill] = useState<SplitBillHistory | null>(null);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState<boolean>(false);
  const [pendingCompleteBillId, setPendingCompleteBillId] = useState<string | null>(null);

  // Calculate progress percentage based on step
  const getProgressPercentage = (step: number) => {
    switch (step) {
      case 0: return 25;
      case 1: return 50;
      case 2: return 75;
      case 3: return 100;
      default: return 0;
    }
  };

  // Animate progress bar
  const animateProgressBar = (fromStep: number, toStep: number) => {
    const fromPercentage = getProgressPercentage(fromStep);
    const toPercentage = getProgressPercentage(toStep);
    
    setProgressFrom(fromPercentage);
    setProgressTo(toPercentage);
    setProgressAnimation(toStep > fromStep ? 'forward' : 'backward');
    
    setTimeout(() => {
      setProgressAnimation(null);
    }, 600);
  };

  // Handle step change with progress animation
  const handleStepChange = (newStep: -1 | 0 | 1 | 2 | 3) => {
    if (newStep !== step) {
      animateProgressBar(step, newStep);
      setStep(newStep);
    }
  };

  // Parse currency to cents
  const parseCurrencyToCents = (raw: string): number => {
    const cleaned = raw
      .replace(/rp/gi, "")
      .replace(/idr/gi, "")
      .replace(/[^0-9,\.]/g, "")
      .trim();
    let digits = cleaned;
    if (cleaned.includes(".") && cleaned.includes(",")) {
      digits = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (cleaned.includes(",") && !cleaned.includes(".")) {
      digits = cleaned.replace(/,/g, "");
    } else {
      digits = cleaned.replace(/\./g, "");
    }
    const value = Number.parseFloat(digits || "0");
    return Math.round((isFinite(value) ? value : 0) * 100);
  };

  const parseReceiptTextToItems = (text: string): { name: string; price_cents: number }[] => {
    const lines = text
      .split(/\r?\n/) 
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .filter(l => !/^(qty\s+item\s+total|subtotal|total|net\s*sales|take[- ]?out|cash|change|kembalian|tendered|card|crew|store|npwp|tax\s*invoice)/i.test(l))
      .filter(l => !/^[-•]|^(no\s)/i.test(l));

    const results: { name: string; price_cents: number }[] = [];
    for (const line of lines) {
      let match = line.match(/^\d+\s+(.+?)\s+([0-9\.,]+)$/);
      if (!match) match = line.match(/(.+?)\s+([0-9\.,]+)$/);
      if (match) {
        const name = match[1].replace(/x\d+$/i, "").trim();
        const cents = parseCurrencyToCents(match[2]);
        if (name && cents > 0) results.push({ name, price_cents: cents });
      }
    }
    if (results.length === 0) {
      for (const line of lines) {
        const m = line.match(/([0-9\.,]+)/);
        if (m) {
          const cents = parseCurrencyToCents(m[1]);
          const name = line.replace(m[0], "").trim();
          if (name && cents > 0) results.push({ name, price_cents: cents });
        }
      }
    }
    return results.slice(0, 50);
  };

  // Handle image upload with OCR
  const handleImageUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      try {
        setIsOcrLoading(true);
        const parsed = await parseReceiptImage(dataUrl);
        const itemsFromOcr = parsed.items;
        if (itemsFromOcr.length === 0) {
          toast({ title: "No items detected", description: "Try a clearer image or add items manually." });
        } else {
          setItems(prev => [
            ...prev,
            ...itemsFromOcr.map(i => ({ 
              id: crypto.randomUUID(), 
              name: i.name, 
              price_cents: i.price_cents, 
              participants: [] 
            }))
          ]);
          toast({ title: "Items detected", description: `Added ${itemsFromOcr.length} item(s) from receipt.` });
        }
      } catch (e) {
        toast({ title: "OCR failed", description: "Could not read text from image. Please add items manually." });
      } finally {
        setIsOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Person management
  const addPerson = (name: string) => {
    setPeople(prev => [...prev, { id: crypto.randomUUID(), name }]);
  };

  const removePerson = (id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id));
    setItems(prev => prev.map(it => ({ 
      ...it, 
      participants: it.participants.filter(pid => pid !== id) 
    })));
  };

  // Item management
  const addItem = (name: string, priceCents: number) => {
    setItems(prev => [...prev, { 
      id: crypto.randomUUID(), 
      name, 
      price_cents: priceCents, 
      participants: [] 
    }]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const editItem = (itemId: string, newPrice: number) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, price_cents: newPrice } : it));
  };

  const togglePersonInItem = (itemId: string, personId: string) => {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it;
      const isIn = it.participants.includes(personId);
      return { 
        ...it, 
        participants: isIn 
          ? it.participants.filter(id => id !== personId) 
          : [...it.participants, personId] 
      };
    }));
  };

  // Auto-add current user when entering step 1
  useEffect(() => {
    if (step === 1) {
    const defaultName = (profile?.full_name || user?.email?.split('@')[0] || '').trim();
      if (defaultName) {
        const existingUser = people.find(p => p.name === defaultName);
        const isMyPersonIdValid = myPersonId && people.some(p => p.id === myPersonId);
        
        if (!existingUser || !isMyPersonIdValid) {
          const newPerson = { id: crypto.randomUUID(), name: defaultName };
          setPeople(prev => [...prev, newPerson]);
          setMyPersonId(newPerson.id);
          setMyName(defaultName);
        }
      }
    }
  }, [step, profile?.full_name, user?.email, people, myPersonId]);

  // Calculation: split each item equally among its participants
  const personTotals: PersonTotals = useMemo(() => {
    const totals: PersonTotals = {};
    people.forEach(p => (totals[p.id] = { 
      subtotal_cents: 0, 
      tax_cents: 0, 
      service_cents: 0, 
      total_cents: 0, 
      shares: [] 
    }));

    items.forEach(item => {
      const n = item.participants.length || 1;
      const share = Math.round(item.price_cents / n);
      item.participants.forEach(pid => {
        if (!totals[pid]) {
          totals[pid] = { 
            subtotal_cents: 0, 
            tax_cents: 0, 
            service_cents: 0, 
            total_cents: 0, 
            shares: [] 
          };
        }
        totals[pid].subtotal_cents += share;
        totals[pid].shares.push({ itemId: item.id, name: item.name, share_cents: share });
      });
    });

    const subtotalSum = Object.values(totals).reduce((s, t) => s + (t.subtotal_cents || 0), 0);
    const entries = Object.entries(totals);

    const taxPct = Math.max(0, Math.min(100, taxServicePercent || 0));
    if (taxPct > 0 && subtotalSum > 0) {
      const perPersonBase = entries.map(([pid, t]) => ({ pid, base: (t.subtotal_cents || 0) }));
      const totalBase = perPersonBase.reduce((s, x) => s + x.base, 0);
      const totalFee = Math.round(totalBase * taxPct / 100);
      let allocated = 0;
      perPersonBase.forEach((x, idx) => {
        const share = idx === perPersonBase.length - 1 
          ? Math.max(0, totalFee - allocated) 
          : Math.round((x.base / totalBase) * totalFee);
        totals[x.pid].service_cents = 0;
        totals[x.pid].tax_cents = share;
        allocated += share;
      });
    }

    Object.values(totals).forEach(t => {
      t.total_cents = (t.subtotal_cents || 0) + (t.service_cents || 0) + (t.tax_cents || 0);
    });

    return totals;
  }, [people, items, taxServicePercent]);

  // Calculate total bill amount
  const totalBillAmount = useMemo(() => {
    const subtotalSum = items.reduce((sum, item) => sum + item.price_cents, 0);
    const taxPct = Math.max(0, Math.min(100, taxServicePercent || 0));
    const taxServiceAmount = Math.round(subtotalSum * taxPct / 100);
    return subtotalSum + taxServiceAmount;
  }, [items, taxServicePercent]);

  // Reset function
  const resetSplitBillState = useCallback(() => {
    setImagePreview(null);
    setIsOcrLoading(false);
    setPeople([]);
    setItems([]);
    setTaxServicePercent(0);
    handleStepChange(startAtStep as -1 | 0 | 1 | 2 | 3);
    setAssignPersonId(null);
    setMyPersonId(null);
    setMyName("");
  }, [startAtStep]);

  // Expose reset function to parent component
  useEffect(() => {
    if (onReset) {
      onReset(resetSplitBillState);
    }
  }, [onReset, resetSplitBillState]);

  // Reset state when screen becomes inactive
  useEffect(() => {
    if (isActive === false) {
      const hasData = imagePreview || people.length > 0 || items.length > 0;
      if (hasData) {
        setTimeout(() => {
          resetSplitBillState();
        }, 0);
      }
    }
  }, [isActive, resetSplitBillState]);

  // Reset state when returning to main split page
  useEffect(() => {
    if (step === -1) {
      const hasData = imagePreview || people.length > 0 || items.length > 0;
      if (hasData) {
                            setTimeout(() => {
          resetSplitBillState();
        }, 0);
      }
    }
  }, [step, resetSplitBillState]);

  // Load split bill history on mount
  useEffect(() => {
    loadSplitBillHistory();
  }, [loadSplitBillHistory]);

  // Handle view split bill detail
  const handleViewSplitBillDetail = (bill: SplitBillHistory) => {
    setSelectedSplitBill(bill);
    setShowSplitBillDetail(true);
  };

  const handleCloseSplitBillDetail = () => {
    setShowSplitBillDetail(false);
    setSelectedSplitBill(null);
  };

  // Handle payment toggle
  const handlePaymentToggle = (billId: string, personId: string, hasPaid: boolean) => {
    updatePaymentStatus(billId, personId, hasPaid);
    
    if (selectedSplitBill && selectedSplitBill.id === billId) {
      setSelectedSplitBill({
        ...selectedSplitBill,
        payment_status: {
          ...selectedSplitBill.payment_status,
          [personId]: hasPaid
        }
      });
      
      const allPaid = selectedSplitBill.people.every(person => 
        person.id === personId ? hasPaid : ((selectedSplitBill.payment_status || {})[person.id] || false)
      );
      
      if (allPaid && hasPaid) {
        setPendingCompleteBillId(billId);
        setConfirmCompleteOpen(true);
      }
    }
  };

  const handleConfirmComplete = () => {
    if (!pendingCompleteBillId) return;
    removeSplitBill(pendingCompleteBillId);
    setConfirmCompleteOpen(false);
    setPendingCompleteBillId(null);
    handleCloseSplitBillDetail();
    toast({
      title: "Split Bill Completed",
      description: "All participants have paid. The bill has been removed.",
    });
  };

  const handleCancelComplete = () => {
    setConfirmCompleteOpen(false);
    setPendingCompleteBillId(null);
  };

  // Handle complete split bill
  const handleComplete = async () => {
                  setIsProcessing(true);
                  let hasError = false;
                  try {
                    const today = new Date();
                    const date = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                    
                    const totalAmount = Object.values(personTotals).reduce((sum, person) => sum + (person?.total_cents || 0), 0);
                    
                    const splitBillData = {
                      id: crypto.randomUUID(),
                      date,
                      total_amount_cents: totalAmount,
                      people,
                      items,
                      tax_choice: 'none' as 'none',
                      service_fee_cents: 0,
                      person_totals: personTotals,
        payment_status: {},
                      created_at: new Date().toISOString(),
                    };
                    
                    await saveSplitBillHistory(splitBillData);
                    
                    if (myPersonId) {
                      const total = personTotals[myPersonId]?.total_cents || 0;
                      if (total > 0) {
                        const who = myName.trim() || people.find(p => p.id === myPersonId)?.name || 'Me';
                        await createTransaction({
                          date,
                          description: `Split bill (${who})`,
                          type: 'debit',
                          amount_cents: total,
                          category: 'Split Bill',
                        });
          toast({ 
            title: 'Split bill saved', 
            description: 'Your share has been saved and split bill history recorded.' 
          });
                      } else {
          toast({ 
            title: 'Split bill saved', 
            description: 'Split bill history has been recorded.' 
          });
                      }
                    } else {
        toast({ 
          title: 'Split bill saved', 
          description: 'Split bill history has been recorded.' 
        });
                    }
                  } catch (error) {
                    hasError = true;
      toast({ 
        title: 'Error', 
        description: 'Failed to save split bill. Please try again.' 
      });
                  } finally {
                    setIsProcessing(false);
                    if (!hasError) {
                      if (onNavigate) {
                        onNavigate();
                      } else {
                        handleStepChange(-1);
                      }
                    }
                  }
  };

  // Render appropriate screen based on step
  if (step === -1) {
    return (
      <>
        <SplitBillListScreen
          splitBillHistory={splitBillHistory}
          onStartNewBill={() => handleStepChange(0)}
          onViewBillDetail={handleViewSplitBillDetail}
        />
        {showSplitBillDetail && selectedSplitBill && (
          <SplitBillDetailModal
            splitBill={selectedSplitBill}
            onClose={handleCloseSplitBillDetail}
            onPaymentToggle={handlePaymentToggle}
          />
        )}
        <Dialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
          <DialogContent className="max-w-sm rounded-2xl">
              <DialogHeader>
              <DialogTitle>Mark bill as complete?</DialogTitle>
              </DialogHeader>
            <div className="py-2 text-sm text-muted-foreground">
              All participants have paid. This will remove the bill from Active Split Bills.
                </div>
            <DialogFooter className="gap-5">
              <Button variant="outline" onClick={handleCancelComplete}>Cancel</Button>
              <Button className="btn-primary" onClick={handleConfirmComplete}>Confirm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
      </>
    );
  }

  if (step === 0) {
    return (
      <UploadReceiptScreen
        imagePreview={imagePreview}
        isOcrLoading={isOcrLoading}
        items={items}
        onImageUpload={handleImageUpload}
        onBack={() => onNavigate ? onNavigate() : handleStepChange(-1)}
        onContinue={() => handleStepChange(1)}
        onEditItem={editItem}
        onRemoveItem={removeItem}
        progressAnimation={progressAnimation}
        progressFrom={progressFrom}
        progressTo={progressTo}
      />
    );
  }

  if (step === 1) {
    return (
      <AddPeopleScreen
        people={people}
        myPersonId={myPersonId}
        onAddPerson={addPerson}
        onRemovePerson={removePerson}
        onBack={() => handleStepChange(0)}
        onContinue={() => handleStepChange(2)}
        progressAnimation={progressAnimation}
        progressFrom={progressFrom}
        progressTo={progressTo}
      />
    );
  }

  if (step === 2) {
    return (
      <AssignItemsScreen
        people={people}
        items={items}
        taxServicePercent={taxServicePercent}
        personTotals={personTotals}
        totalBillAmount={totalBillAmount}
        assignPersonId={assignPersonId}
        onAddItem={addItem}
        onRemoveItem={removeItem}
        onEditItem={editItem}
        onTogglePersonInItem={togglePersonInItem}
        onSetTaxServicePercent={setTaxServicePercent}
        onSetAssignPersonId={setAssignPersonId}
        onBack={() => handleStepChange(1)}
        onContinue={() => handleStepChange(3)}
        progressAnimation={progressAnimation}
        progressFrom={progressFrom}
        progressTo={progressTo}
      />
    );
  }

  if (step === 3) {
    return (
      <ReviewSplitBillScreen
        people={people}
        personTotals={personTotals}
        isProcessing={isProcessing}
        onBack={() => handleStepChange(2)}
        onComplete={handleComplete}
        progressAnimation={progressAnimation}
        progressFrom={progressFrom}
        progressTo={progressTo}
      />
    );
  }

  return null;
};
