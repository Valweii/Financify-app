import { useMemo, useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, ImagePlus, History, Receipt, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { useFinancifyStore, type SplitBillHistory } from "@/store";
import { SplitBillHistoryScreen } from "./SplitBillHistoryScreen";
import { toast } from "@/components/ui/use-toast";
import { parseReceiptImage } from "@/lib/receipt-ocr";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";

// Local types for split bill
type Person = { id: string; name: string };

type Item = {
  id: string;
  name: string;
  price_cents: number;
  participants: string[]; // person ids
};

export const SplitBillScreen = ({ onReset, isActive, onNavigate, startAtStep = -1 }: { onReset?: (resetFn: () => void) => void; isActive?: boolean; onNavigate?: () => void; startAtStep?: number }) => {
  const { createTransaction, user, profile, saveSplitBillHistory, splitBillHistory, loadSplitBillHistory } = useFinancifyStore();
  const navigate = useNavigate();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  // Single percent input for combined Tax & Service (e.g., 10.5 means 10.5%)
  const [taxServicePercent, setTaxServicePercent] = useState<number>(0);
  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editItemPrice, setEditItemPrice] = useState<string>("0");
  const [step, setStep] = useState<-1 | 0 | 1 | 2 | 3>(startAtStep as -1 | 0 | 1 | 2 | 3);
  const [assignPersonId, setAssignPersonId] = useState<string | null>(null);
  
  const [myPersonId, setMyPersonId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>("");
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isExitingEditMode, setIsExitingEditMode] = useState<boolean>(false);
  const [microInteractionInProgress, setMicroInteractionInProgress] = useState<boolean>(false);
  const [showEditIcons, setShowEditIcons] = useState<boolean>(false);
  const [animationKey, setAnimationKey] = useState<number>(0);
  const [progressAnimation, setProgressAnimation] = useState<'forward' | 'backward' | null>(null);
  const [progressFrom, setProgressFrom] = useState<number>(0);
  const [progressTo, setProgressTo] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

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
    
    // Reset animation after it completes
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

  // Handle edit mode toggle with exit animation
  const handleEditModeToggle = () => {
    // Prevent double-click during animation
    if (isExitingEditMode) return;
    
    if (isEditMode) {
      // Clear any inline transform styles that might interfere with animation
      const editButtons = document.querySelectorAll('button[aria-label="Edit price"]');
      const deleteButtons = document.querySelectorAll('button[aria-label="Delete item"]');
      editButtons.forEach(btn => (btn as HTMLElement).style.transform = '');
      deleteButtons.forEach(btn => (btn as HTMLElement).style.transform = '');
      
      // Exiting edit mode - start exit animation
      setIsExitingEditMode(true);
      setAnimationKey(prev => prev + 1); // Force re-render
      
      // Keep icons mounted but hidden during animation, then unmount
      setTimeout(() => {
        setShowEditIcons(false);
        // Small delay before resetting states to ensure smooth unmount
        setTimeout(() => {
          setIsEditMode(false);
          setIsExitingEditMode(false);
        }, 50);
      }, 400); // Match animation duration exactly
    } else {
      // Entering edit mode
      setIsEditMode(true);
      setShowEditIcons(true);
      setAnimationKey(prev => prev + 1); // Force re-render
    }
  };


  // Reset edit mode when changing steps
  useEffect(() => {
    // Always reset edit mode states when step changes
    setIsEditMode(false);
    setIsExitingEditMode(false);
    setShowEditIcons(false);
  }, [step]);

  // Handle navigation to split bill page
  const handleStartSplitBill = () => {
    navigate('/split-bill');
  };

  const handleViewHistory = () => {
    navigate('/active-split-bills');
  };


  const [newPersonName, setNewPersonName] = useState("");
  const [draftItem, setDraftItem] = useState<{ name: string; price_cents: number; participants: string[] }>({ name: "", price_cents: 0, participants: [] });


  // Auto-add current user when entering step 1
  useEffect(() => {
    if (step === 1) {
      const defaultName = (profile?.full_name || user?.email?.split('@')[0] || '').trim();
      if (defaultName) {
        // Check if user already exists by name or if myPersonId is stale
        const existingUser = people.find(p => p.name === defaultName);
        const isMyPersonIdValid = myPersonId && people.some(p => p.id === myPersonId);
        
        // Add user if they don't exist or if myPersonId is invalid
        if (!existingUser || !isMyPersonIdValid) {
          const newPerson = { id: crypto.randomUUID(), name: defaultName };
          setPeople(prev => [...prev, newPerson]);
          setMyPersonId(newPerson.id);
          setMyName(defaultName);
        }
      }
    }
  }, [step, profile?.full_name, user?.email, people, myPersonId]);

  // Reset function to reset all state to initial values
  const resetSplitBillState = useCallback(() => {
    setImagePreview(null);
    setIsOcrLoading(false);
    setPeople([]);
    setItems([]);
    setTaxServicePercent(0);
    setIsAddPersonOpen(false);
    setIsAddItemOpen(false);
    setIsEditItemOpen(false);
    setEditItemId(null);
    setEditItemPrice("0");
    handleStepChange(startAtStep as -1 | 0 | 1 | 2 | 3);
    setAssignPersonId(null);
    setMyPersonId(null);
    setMyName("");
    setIsEditMode(false);
    setIsExitingEditMode(false);
    setShowEditIcons(false);
    setAnimationKey(0);
    setNewPersonName("");
    setDraftItem({ name: "", price_cents: 0, participants: [] });
  }, [startAtStep]);

  // Expose reset function to parent component
  useEffect(() => {
    if (onReset) {
      onReset(resetSplitBillState);
    }
  }, [onReset, resetSplitBillState]);

  // Reset state when screen becomes inactive (user navigates away)
  useEffect(() => {
    if (isActive === false) {
      // Check if we have any data that indicates we were in the middle of a flow
      const hasData = imagePreview || people.length > 0 || items.length > 0;
      if (hasData) {
        // Use setTimeout to avoid state update during render
        setTimeout(() => {
          resetSplitBillState();
        }, 0);
      }
    }
  }, [isActive, resetSplitBillState]);

  // Reset state when returning to main split page (step -1)
  // This will only trigger when user manually navigates back to step -1
  useEffect(() => {
    if (step === -1) {
      // Check if we have any data that indicates we were in the middle of a flow
      const hasData = imagePreview || people.length > 0 || items.length > 0;
      if (hasData) {
        // Use setTimeout to avoid state update during render
        setTimeout(() => {
          resetSplitBillState();
        }, 0);
      }
    }
  }, [step, resetSplitBillState]);

  const parseCurrencyToCents = (raw: string): number => {
    // Normalize Indonesian/US formats: remove currency, spaces, dots as thousand sep, commas as decimal
    const cleaned = raw
      .replace(/rp/gi, "")
      .replace(/idr/gi, "")
      .replace(/[^0-9,\.]/g, "")
      .trim();
    // If both comma and dot present, assume dot thousand, comma decimal
    let digits = cleaned;
    if (cleaned.includes(".") && cleaned.includes(",")) {
      digits = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (cleaned.includes(",") && !cleaned.includes(".")) {
      // comma used as thousand or decimal; assume thousand removed
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
      .filter(l => !/^[-•]|^(no\s)/i.test(l)); // drop modifiers lines like "- Pickle/Slice" or "NO Sauce"

    const results: { name: string; price_cents: number }[] = [];
    for (const line of lines) {
      // Patterns like: "1 Bottled Mineral Water      9,500" or "Bottled Mineral Water ... 9.500"
      let match = line.match(/^\d+\s+(.+?)\s+([0-9\.,]+)$/);
      if (!match) match = line.match(/(.+?)\s+([0-9\.,]+)$/);
      if (match) {
        const name = match[1].replace(/x\d+$/i, "").trim();
        const cents = parseCurrencyToCents(match[2]);
        if (name && cents > 0) results.push({ name, price_cents: cents });
      }
    }
    // Fallback: if nothing parsed, try to find amounts anywhere and use preceding word
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

  const parseReceiptTextForTax = (text: string, subtotalCents: number): number => {
    const lines = text.split(/\r?\n/).map(l => l.trim());
    for (const line of lines) {
      if (!/(ppn|tax|pajak|service)/i.test(line)) continue;
      const mAmt = line.match(/([0-9\.,]+)\s*$/);
      if (mAmt) {
        const cents = parseCurrencyToCents(mAmt[1]);
        if (cents > 0) return cents;
      }
    }
    for (const line of lines) {
      const mPct = line.match(/(ppn|tax|pajak)[^\d]*([0-9]{1,2})\s*%/i);
      if (mPct) {
        const pct = parseInt(mPct[2], 10);
        if (pct > 0 && subtotalCents > 0) return Math.round(subtotalCents * pct / 100);
      }
    }
    return 0;
  };

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
            ...itemsFromOcr.map(i => ({ id: crypto.randomUUID(), name: i.name, price_cents: i.price_cents, participants: [] }))
          ]);
          toast({ title: "Items detected", description: `Added ${itemsFromOcr.length} item(s) from receipt.` });
        }
          // Do not auto-advance; user reviews items first
      } catch (e) {
        toast({ title: "OCR failed", description: "Could not read text from image. Please add items manually." });
        // Do not auto-advance on error
      } finally {
        setIsOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const addPerson = () => {
    const trimmed = newPersonName.trim();
    if (!trimmed) return;
    setPeople(prev => [...prev, { id: crypto.randomUUID(), name: trimmed }]);
    setNewPersonName("");
    setIsAddPersonOpen(false);
  };

  const addItem = () => {
    const name = draftItem.name.trim();
    if (!name || draftItem.price_cents <= 0) return;
    setItems(prev => [...prev, { id: crypto.randomUUID(), name, price_cents: draftItem.price_cents, participants: [] }]);
    setDraftItem({ name: "", price_cents: 0, participants: [] });
    setIsAddItemOpen(false);
  };

  const removePerson = (id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id));
    setItems(prev => prev.map(it => ({ ...it, participants: it.participants.filter(pid => pid !== id) })));
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(it => it.id !== id));

  const saveEditItem = () => {
    const v = Math.max(0, parseInt(editItemPrice || '0', 10));
    if (!editItemId) { setIsEditItemOpen(false); return; }
    setItems(prev => prev.map(it => it.id === editItemId ? { ...it, price_cents: v } : it));
    setIsEditItemOpen(false);
  };

  const togglePersonInItem = (itemId: string, personId: string) => {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it;
      const isIn = it.participants.includes(personId);
      return { ...it, participants: isIn ? it.participants.filter(id => id !== personId) : [...it.participants, personId] };
    }));
  };

  const getInitials = (name: string) => name.split(" ").map(s => s[0]).join("").slice(0,2).toUpperCase();

  // Load split bill history on mount
  useEffect(() => {
    loadSplitBillHistory();
  }, [loadSplitBillHistory]);

  // Auto-register current user as a participant in the Add people step
  useEffect(() => {
    const defaultName = (profile?.full_name || user?.email?.split('@')[0] || '').trim();
    if (!defaultName) return;
    // only add if not present yet
    const existing = people.find(p => p.name.toLowerCase() === defaultName.toLowerCase());
    if (existing) {
      setMyPersonId(existing.id);
      return;
    }
    const newP = { id: crypto.randomUUID(), name: defaultName } as Person;
    setPeople(prev => [newP, ...prev]);
    setMyPersonId(newP.id);
  }, [profile, user]);

  // Calculation: split each item equally among its participants
  const personTotals = useMemo(() => {
    const totals: Record<string, { subtotal_cents: number; tax_cents: number; service_cents: number; total_cents: number; shares: { itemId: string; name: string; share_cents: number }[] }> = {};
    people.forEach(p => (totals[p.id] = { subtotal_cents: 0, tax_cents: 0, service_cents: 0, total_cents: 0, shares: [] }));
    // Subtotals from items
    items.forEach(item => {
      const n = item.participants.length || 1;
      const share = Math.round(item.price_cents / n);
      item.participants.forEach(pid => {
        if (!totals[pid]) totals[pid] = { subtotal_cents: 0, tax_cents: 0, service_cents: 0, total_cents: 0, shares: [] } as any;
        totals[pid].subtotal_cents += share;
        totals[pid].shares.push({ itemId: item.id, name: item.name, share_cents: share });
      });
    });

    const subtotalSum = Object.values(totals).reduce((s, t) => s + (t.subtotal_cents || 0), 0);
    const entries = Object.entries(totals);

    // Single combined percent applied proportionally to subtotal
    const taxPct = Math.max(0, Math.min(100, taxServicePercent || 0));
    if (taxPct > 0 && subtotalSum > 0) {
      const perPersonBase = entries.map(([pid, t]) => ({ pid, base: (t.subtotal_cents || 0) }));
      const totalBase = perPersonBase.reduce((s, x) => s + x.base, 0);
      const totalFee = Math.round(totalBase * taxPct / 100);
      let allocated = 0;
      perPersonBase.forEach((x, idx) => {
        const share = idx === perPersonBase.length - 1 ? Math.max(0, totalFee - allocated) : Math.round((x.base / totalBase) * totalFee);
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

  // Calculate total bill (all items + tax & service fee)
  const totalBillAmount = useMemo(() => {
    const subtotalSum = items.reduce((sum, item) => sum + item.price_cents, 0);
    const taxPct = Math.max(0, Math.min(100, taxServicePercent || 0));
    const taxServiceAmount = Math.round(subtotalSum * taxPct / 100);
    return subtotalSum + taxServiceAmount;
  }, [items, taxServicePercent]);

  const canProceedFromPeople = people.length > 0;
  const allItemsHaveParticipants = items.length > 0 && items.every(it => it.participants.length > 0);

  // Ensure a selected person exists for assignment step
  if (step === 2 && !assignPersonId && people.length > 0) {
    setAssignPersonId(people[0].id);
  }

  return (
          <div className="flex flex-col space-y-6">
      <div className="space-y-2">
        <h1 className="text-responsive-2xl font-bold">Split Bill</h1>
        {step >= 0 && <p className="text-muted-foreground">Step {step + 1} of 4</p>}
      </div>

      {step === -1 && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4">
            <Card 
              className="financial-card p-6 cursor-pointer hover:shadow-lg transition-shadow" 
              onClick={handleStartSplitBill}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleStartSplitBill();
                }
              }}
            >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Receipt className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-responsive-lg font-semibold">Split a Bill Now</h3>
                    <p className="text-muted-foreground">Start a new bill splitting session</p>
                  </div>
                </div>
              </Card>
              
            <Card 
              className="financial-card p-6 cursor-pointer hover:shadow-lg transition-shadow" 
              onClick={handleViewHistory}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleViewHistory();
                }
              }}
            >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <History className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-responsive-lg font-semibold">View Active Split Bill</h3>
                    <p className="text-muted-foreground">See your active split bills and payment status</p>
                  </div>
                </div>
              </Card>
            </div>
        </div>
      )}

      {step === 0 && (
        <div className="space-y-6">
          {/* Header with back button and progress */}
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onNavigate ? onNavigate() : handleStepChange(-1)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex-1 mx-4">
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className={`bg-primary h-2 rounded-full progress-bar-fill ${
                    progressAnimation === 'forward' ? 'progress-bar-fill-forward' : 
                    progressAnimation === 'backward' ? 'progress-bar-fill-backward' : ''
                  }`}
                  style={{ 
                    width: progressAnimation ? 'var(--progress-to)' : '25%',
                    '--progress-from': `${progressFrom}%`,
                    '--progress-to': `${progressTo}%`
                  } as React.CSSProperties}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-1">Step 1 of 4</p>
            </div>
            <div className="w-16"></div> {/* Spacer for balance */}
          </div>

          {/* Main content */}
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Upload Your Receipt</h2>
              <p className="text-muted-foreground">Take a photo or choose from gallery</p>
            </div>
            {isOcrLoading ? (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center pointer-events-auto">
                <Card className="financial-card p-8 max-w-sm mx-4">
                  <div className="flex flex-col items-center justify-center space-y-6">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                      <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-primary/40 rounded-full animate-pulse"></div>
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-responsive-lg font-semibold text-primary">Processing Receipt</p>
                      <p className="text-responsive-sm text-muted-foreground">Detecting items automatically...</p>
                      <div className="flex items-center justify-center space-x-1 mt-3">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            ) : (
              <>
                {imagePreview ? (
                  <div className="space-y-4">
                    {/* After upload, show editable item summary before continue */}
                    <div className="bg-muted/30 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-3">Detected Items</h3>
                      <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                      {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No items detected yet. You can add them manually in the next step.</p>
                      ) : (
                        items.map(it => (
                            <div key={it.id} className="p-3 rounded-lg border border-border/50 flex items-center justify-between bg-background">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{it.name}</p>
                            </div>
            <div className="flex items-center gap-2">
                              <div className="w-24 text-right">
                                <MoneyDisplay amount={it.price_cents} size="md" animate={false} />
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setEditItemId(it.id); setEditItemPrice(String(it.price_cents)); setIsEditItemOpen(true); }}
                                aria-label="Edit price"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(it.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="space-y-3">
                      <Button 
                        onClick={() => handleStepChange(1)}
                        className="w-full btn-primary"
                        disabled={items.length === 0}
                      >
                        Continue to People
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                      <Button 
                        onClick={() => handleStepChange(1)}
                        variant="outline"
                        className="w-full"
                        disabled={items.length === 0}
                      >
                        Enter items manually instead
                      </Button>
              </div>
            </div>
                ) : (
                  <div className="space-y-6">
                    {/* Upload area */}
                    <div className="border-2 border-dashed border-primary/30 rounded-xl p-8 bg-primary/5 hover:bg-primary/10 transition-colors">
                      <div className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                          <Receipt className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">Choose Receipt</h3>
                          <p className="text-sm text-muted-foreground">Upload a photo or PDF of your receipt</p>
                        </div>
                        <label className="btn-primary w-full inline-flex items-center justify-center rounded-md px-6 py-3 cursor-pointer hover:opacity-90 transition-opacity">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && e.target.files[0] && handleImageUpload(e.target.files[0])} />
                          Choose Receipt
            </label>
                      </div>
                    </div>
                    
                    {/* Skip option */}
                    <div className="text-center">
                      <Button 
                        onClick={() => handleStepChange(1)}
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Enter items manually instead
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          {/* Header with back button and progress */}
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleStepChange(0)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex-1 mx-4">
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className={`bg-primary h-2 rounded-full progress-bar-fill ${
                    progressAnimation === 'forward' ? 'progress-bar-fill-forward' : 
                    progressAnimation === 'backward' ? 'progress-bar-fill-backward' : ''
                  }`}
                  style={{ 
                    width: progressAnimation ? 'var(--progress-to)' : '50%',
                    '--progress-from': `${progressFrom}%`,
                    '--progress-to': `${progressTo}%`
                  } as React.CSSProperties}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-1">Step 2 of 4</p>
            </div>
            <div className="w-16"></div> {/* Spacer for balance */}
          </div>

          {/* Main content */}
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Add People</h2>
              <p className="text-muted-foreground">Who's splitting this bill?</p>
            </div>

            <Card className="financial-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">People</h3>
            <Dialog open={isAddPersonOpen} onOpenChange={setIsAddPersonOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="btn-primary"><Plus className="w-4 h-4 mr-1" /> Add Person</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Person</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Name</label>
                    <Input value={newPersonName} onChange={(e) => setNewPersonName(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={addPerson} className="btn-primary">Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {people.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No people added yet</p>
            )}
            {people.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-medium truncate">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {p.id !== myPersonId && (
                    <Button variant="ghost" size="icon" onClick={() => removePerson(p.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

            {/* Continue button */}
            <Button 
              onClick={() => handleStepChange(2)}
              className="w-full btn-primary"
              disabled={people.length === 0}
            >
              Continue to Items
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          {/* Header with back button and progress */}
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleStepChange(1)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex-1 mx-4">
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className={`bg-primary h-2 rounded-full progress-bar-fill ${
                    progressAnimation === 'forward' ? 'progress-bar-fill-forward' : 
                    progressAnimation === 'backward' ? 'progress-bar-fill-backward' : ''
                  }`}
                  style={{ 
                    width: progressAnimation ? 'var(--progress-to)' : '75%',
                    '--progress-from': `${progressFrom}%`,
                    '--progress-to': `${progressTo}%`
                  } as React.CSSProperties}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-1">Step 3 of 4</p>
            </div>
            <div className="w-16"></div> {/* Spacer for balance */}
          </div>

          {/* Main content */}
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className={`text-2xl font-bold transition-opacity duration-300 ease-in-out ${
                isEditMode ? 'opacity-90' : isExitingEditMode ? 'opacity-90' : 'opacity-100'
              }`}>Assign Items</h2>
              <p className="text-muted-foreground">Who's paying for what?</p>
            </div>

            <Card className="financial-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Items</h3>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleEditModeToggle}
                    className={`transition-all duration-300 ease-in-out ${
                      isEditMode 
                        ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                        : isExitingEditMode
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <span className="transition-opacity duration-300 ease-in-out">
                {isEditMode ? 'Done Editing' : 'Edit Mode'}
                    </span>
              </Button>
            <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
              <DialogTrigger asChild>
                  <Button variant="outline" size="sm"><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Item</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Item Name</label>
                    <Input value={draftItem.name} onChange={(e) => setDraftItem({ ...draftItem, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Price (IDR)</label>
                    <Input type="number" min={0} value={draftItem.price_cents || ''} placeholder="0" onChange={(e) => setDraftItem({ ...draftItem, price_cents: Math.max(0, parseInt(e.target.value || '0', 10)) })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={addItem} className="btn-primary">Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
            </div>
          {/* Removed Set your participant: auto-assign current username via effect */}
          {/* Participant selector (avatars) */}
          <div className="mb-3">
            <div className="flex items-center gap-2 py-1 overflow-x-auto scrollbar-hide">
              {people.map(p => (
                <button
                  key={p.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm hover:shadow transition-all ${assignPersonId === p.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground bg-card'}`}
                  onClick={() => setAssignPersonId(p.id)}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px]">{getInitials(p.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs max-w-[72px] truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Tax & Service controls - single percent */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-sm text-muted-foreground">Tax & Service (%)</label>
              <Input
                type="number"
                step="any"
                min={0}
                max={100}
                value={taxServicePercent || ''}
                placeholder="0"
                onChange={(e) => setTaxServicePercent(Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
              />
            </div>
            <div className="flex items-end"><div className="text-sm text-muted-foreground">&nbsp;</div></div>
          </div>
          
          {/* All Items Total + Tax & Service Fee */}
          {items.length > 0 && (
            <div className="rounded-lg border border-primary/20 p-3 mb-3 bg-primary/5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-primary">Total Bill (Items + Tax & Service)</div>
                <MoneyDisplay 
                  amount={totalBillAmount} 
                  size="md" 
                  animate={false} 
                />
              </div>
            </div>
          )}
          
          {/* Preview Current total */}
          {assignPersonId && (
              <div className="rounded-lg border border-border/50 p-3 mb-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{people.find(p => p.id === assignPersonId)?.name || 'Current participant'} current total</div>
                  <MoneyDisplay amount={personTotals[assignPersonId]?.total_cents || 0} size="md" animate={false} />
              </div>
            </div>
          )}
          {/* Quick actions */}
          <div className="flex-1 space-y-2 overflow-y-auto">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">No items yet</p>
            )}
            {items.map((it, index) => {
              const isSelected = Boolean(assignPersonId && it.participants.includes(assignPersonId));
              const animationDelay = isEditMode ? `${index * 40}ms` : isExitingEditMode ? `${index * 40}ms` : '0ms';
              return (
                <div key={it.id} className="relative flex items-center gap-2">
                  {/* Main Card */}
                  <div
                    className={`flex-1 p-3 rounded-xl border transition-[background-color,border-color,box-shadow] duration-200 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary shadow-md'
                        : 'bg-card/60 border-border/50 hover:shadow-[var(--shadow-float)]'
                    }`}
                    onClick={() => assignPersonId && togglePersonInItem(it.id, assignPersonId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if ((e.key === ' ' || e.key === 'Enter') && assignPersonId) {
                        e.preventDefault();
                        togglePersonInItem(it.id, assignPersonId);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Left side - Item content */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{it.name}</p>
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1 ${isSelected ? 'opacity-90' : 'opacity-70'}`}>
                            {it.participants.length === 0 ? (
                              <span className="text-sm text-muted-foreground">No participants</span>
                            ) : (
                              it.participants.map(pid => {
                                const person = people.find(p => p.id === pid);
                                return (
                                  <Avatar key={pid} className="h-5 w-5">
                                    <AvatarFallback className="text-[9px]">{getInitials(person?.name || 'U')}</AvatarFallback>
                                  </Avatar>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Right side - Price */}
                      <div className="flex items-center justify-end flex-shrink-0">
                        <div className="w-20 text-right">
                          <MoneyDisplay amount={it.price_cents} size="md" animate={false} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Edit/Delete icons outside the card */}
                  {showEditIcons && (
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {/* Edit Icon */}
                      <Button
                        key={`edit-${it.id}-${animationKey}`}
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { 
                          if (!isExitingEditMode || microInteractionInProgress) {
                            e.stopPropagation(); 
                            setMicroInteractionInProgress(true);
                            setEditItemId(it.id); 
                            setEditItemPrice(String(it.price_cents)); 
                            setIsEditItemOpen(true);
                            setTimeout(() => setMicroInteractionInProgress(false), 200);
                          }
                        }}
                        className={`h-8 w-8 rounded-md bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 dark:text-yellow-400 transition-[background-color] duration-200 ${
                          isEditMode ? 'edit-icon-scale-enter' : isExitingEditMode ? 'edit-icon-scale-exit' : ''
                        }`}
                        style={{ 
                          animationDelay: animationDelay
                        }}
                        aria-label="Edit price"
                        onMouseEnter={(e) => {
                          if (isEditMode && !isExitingEditMode) {
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (isEditMode && !isExitingEditMode) {
                            e.currentTarget.style.transform = 'scale(1)';
                          }
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {/* Delete Icon */}
                      <Button
                        key={`delete-${it.id}-${animationKey}`}
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { 
                          if (!isExitingEditMode || microInteractionInProgress) {
                            e.stopPropagation(); 
                            setMicroInteractionInProgress(true);
                            e.currentTarget.classList.add('delete-icon-press');
                            setTimeout(() => {
                              e.currentTarget.classList.remove('delete-icon-press');
                              setMicroInteractionInProgress(false);
                            }, 150);
                            removeItem(it.id); 
                          }
                        }}
                        className={`h-8 w-8 rounded-md bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 transition-[background-color] duration-200 ${
                          isEditMode ? 'delete-icon-scale-enter' : isExitingEditMode ? 'delete-icon-scale-exit' : ''
                        }`}
                        style={{ 
                          animationDelay: animationDelay
                        }}
                        onMouseEnter={(e) => {
                          if (isEditMode && !isExitingEditMode) {
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (isEditMode && !isExitingEditMode) {
                            e.currentTarget.style.transform = 'scale(1)';
                          }
                        }}
                        aria-label="Delete item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Edit Item Dialog */}
          <Dialog open={isEditItemOpen} onOpenChange={setIsEditItemOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Item</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div>
                  <label className="text-sm text-muted-foreground">Price (IDR)</label>
                  <Input
                    type="number"
                    min={0}
                    value={editItemPrice}
                    placeholder="0"
                    onChange={(e) => setEditItemPrice(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={saveEditItem} className="btn-primary">Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Card>

            {/* Continue button */}
            <Button 
              onClick={() => handleStepChange(3)}
              className="w-full btn-primary"
              disabled={items.length === 0 || items.some(it => it.participants.length === 0)}
            >
              Continue to Review
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          {/* Header with back button and progress */}
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleStepChange(2)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex-1 mx-4">
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className={`bg-primary h-2 rounded-full progress-bar-fill ${
                    progressAnimation === 'forward' ? 'progress-bar-fill-forward' : 
                    progressAnimation === 'backward' ? 'progress-bar-fill-backward' : ''
                  }`}
                  style={{ 
                    width: progressAnimation ? 'var(--progress-to)' : '100%',
                    '--progress-from': `${progressFrom}%`,
                    '--progress-to': `${progressTo}%`
                  } as React.CSSProperties}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-1">Step 4 of 4</p>
            </div>
            <div className="w-16"></div> {/* Spacer for balance */}
          </div>

          {/* Main content */}
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Summary</h2>
              <p className="text-muted-foreground">Review and complete your split bill</p>
            </div>

        <div className="space-y-4">
            {people.map(p => {
              const details = personTotals[p.id];
              return (
                <div key={p.id} className="p-4 rounded-lg border border-border/50 bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-lg">{p.name}</span>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Total</div>
                      <div className="font-semibold text-lg"><MoneyDisplay amount={details?.total_cents || 0} size="lg" animate={false} /></div>
                    </div>
                  </div>
                  
                  {/* Always show details expanded */}
                  <div className="space-y-2">
                    {details?.shares.length ? (
                      <>
                        <div className="text-sm font-medium text-muted-foreground mb-2">Items:</div>
                        {details.shares.map(s => (
                          <div key={s.itemId} className="flex items-center justify-between text-sm py-1">
                            <span className="text-foreground truncate pr-2">{s.name}</span>
                            <MoneyDisplay amount={s.share_cents} size="sm" animate={false} />
                          </div>
                        ))}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No assigned items</p>
                    )}
                    
                    {/* Show breakdown if there are taxes or service fees */}
                    {(details?.tax_cents || 0) > 0 || (details?.service_cents || 0) > 0 ? (
                      <div className="pt-2 mt-2 border-t border-border/50 space-y-1">
                        <div className="text-sm font-medium text-muted-foreground">Breakdown:</div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <MoneyDisplay amount={details?.subtotal_cents || 0} size="sm" animate={false} />
                        </div>
                        {(details?.service_cents || 0) > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Service Fee</span>
                            <MoneyDisplay amount={details?.service_cents || 0} size="sm" animate={false} />
                          </div>
                        )}
                        {(details?.tax_cents || 0) > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Tax</span>
                            <MoneyDisplay amount={details?.tax_cents || 0} size="sm" animate={false} />
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

            {/* Complete button */}
          <Button 
              className="w-full btn-primary"
              disabled={isProcessing}
                onClick={async () => {
                  setIsProcessing(true);
                  let hasError = false;
                  try {
                    const today = new Date();
                    const date = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                    
                    // Calculate total amount for the entire bill
                    const totalAmount = Object.values(personTotals).reduce((sum, person) => sum + (person?.total_cents || 0), 0);
                    
                    // Save split bill history
                    const splitBillData = {
                      id: crypto.randomUUID(),
                      date,
                      total_amount_cents: totalAmount,
                      people,
                      items,
                      tax_choice: 'none' as 'none',
                      service_fee_cents: 0,
                      person_totals: personTotals,
                      payment_status: {}, // Initialize empty payment status
                      created_at: new Date().toISOString(),
                    };
                    
                    await saveSplitBillHistory(splitBillData);
                    
                    // Also create transaction for the current user if they have a share
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
                        toast({ title: 'Split bill saved', description: 'Your share has been saved and split bill history recorded.' });
                      } else {
                        toast({ title: 'Split bill saved', description: 'Split bill history has been recorded.' });
                      }
                    } else {
                      toast({ title: 'Split bill saved', description: 'Split bill history has been recorded.' });
                    }
                  } catch (error) {
                    hasError = true;
                    toast({ title: 'Error', description: 'Failed to save split bill. Please try again.' });
                  } finally {
                    setIsProcessing(false);
                    // Only navigate if there was no error
                    if (!hasError) {
                      if (onNavigate) {
                        onNavigate();
                      } else {
                        handleStepChange(-1);
                      }
                    }
                  }
                }}
              >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Complete Split Bill
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
              </Button>
          </div>
        </div>
      )}

      
      {/* Global Edit Item Price Dialog (available in all steps) */}
          <Dialog open={isEditItemOpen} onOpenChange={setIsEditItemOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Item Price (IDR)</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div>
                  <label className="text-sm text-muted-foreground">Amount</label>
                  <Input
                    type="number"
                    min={0}
                    value={editItemPrice}
                    placeholder="0"
                    onChange={(e) => setEditItemPrice(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    const v = Math.max(0, parseInt(editItemPrice || '0', 10));
                    if (!editItemId) { setIsEditItemOpen(false); return; }
                    setItems(prev => prev.map(it => it.id === editItemId ? { ...it, price_cents: v } : it));
                    setIsEditItemOpen(false);
                  }}
                  className="btn-primary"
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
    </div>
  );
};
