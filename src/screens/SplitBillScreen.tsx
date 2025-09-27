import { useMemo, useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, ChevronDown, ImagePlus, History, Receipt, ArrowLeft, ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { useFinancifyStore, type SplitBillHistory } from "@/store";
import { SplitBillHistoryScreen } from "./SplitBillHistoryScreen";
import { toast } from "@/components/ui/use-toast";
import { parseReceiptImage } from "@/lib/receipt-ocr";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Local types for split bill
type Person = { id: string; name: string };

type Item = {
  id: string;
  name: string;
  price_cents: number;
  participants: string[]; // person ids
};

export const SplitBillScreen = ({ onReset, isActive }: { onReset?: (resetFn: () => void) => void; isActive?: boolean }) => {
  const { createTransaction, user, profile, saveSplitBillHistory, splitBillHistory, loadSplitBillHistory } = useFinancifyStore();
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
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [step, setStep] = useState<-1 | 0 | 1 | 2 | 3>(-1);
  const [showHistory, setShowHistory] = useState(false);
  const [assignPersonId, setAssignPersonId] = useState<string | null>(null);
  const [myPersonId, setMyPersonId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>("");
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isExitingEditMode, setIsExitingEditMode] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [animationDirection, setAnimationDirection] = useState<'enter' | 'exit' | null>(null);

  // Handle edit mode toggle with exit animation
  const handleEditModeToggle = () => {
    if (isEditMode) {
      // Exiting edit mode - start exit animation
      setIsExitingEditMode(true);
      setTimeout(() => {
        setIsEditMode(false);
        setIsExitingEditMode(false);
      }, 300); // Match animation duration
    } else {
      // Entering edit mode
      setIsEditMode(true);
    }
  };

  // Handle swipe animations
  const handleStartSplitBill = () => {
    if (isAnimating) return; // Prevent multiple animations
    setIsAnimating(true);
    setAnimationDirection('exit');
    setTimeout(() => {
      setStep(0);
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

  const handleViewHistory = () => {
    if (isAnimating) return; // Prevent multiple animations
    setIsAnimating(true);
    setAnimationDirection('exit');
    setTimeout(() => {
      setShowHistory(true);
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

  const handleBackFromHistory = () => {
    if (isAnimating) return; // Prevent multiple animations
    setIsAnimating(true);
    setAnimationDirection('exit');
    setTimeout(() => {
      setShowHistory(false);
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

  const [newPersonName, setNewPersonName] = useState("");
  const [draftItem, setDraftItem] = useState<{ name: string; price_cents: number; participants: string[] }>({ name: "", price_cents: 0, participants: [] });

  // Cleanup animation state on unmount
  useEffect(() => {
    return () => {
      setIsAnimating(false);
      setAnimationDirection(null);
    };
  }, []);

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
    setExpandedPersonId(null);
    setStep(-1);
    setShowHistory(false);
    setAssignPersonId(null);
    setMyPersonId(null);
    setMyName("");
    setIsEditMode(false);
    setNewPersonName("");
    setDraftItem({ name: "", price_cents: 0, participants: [] });
  }, []);

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
        console.error(e);
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
    if (expandedPersonId === id) setExpandedPersonId(null);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(it => it.id !== id));


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
          {showHistory ? (
            <div className={`${isAnimating && animationDirection === 'exit' ? 'history-swipe-exit' : 'history-swipe-enter'}`}>
              <SplitBillHistoryScreen onBack={handleBackFromHistory} />
            </div>
          ) : (
            <div className={`flex flex-col gap-4 ${isAnimating && animationDirection === 'exit' ? 'split-swipe-exit' : 'split-swipe-enter'}`}>
              <Card className="financial-card p-6 cursor-pointer hover:shadow-lg transition-shadow" onClick={handleStartSplitBill}>
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
              
              <Card className="financial-card p-6 cursor-pointer hover:shadow-lg transition-shadow" onClick={handleViewHistory}>
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
          )}
        </div>
      )}

      {step === 0 && (
        <Card className={`financial-card p-4 h-[65vh] flex flex-col ${isAnimating && animationDirection === 'enter' ? 'split-swipe-enter' : isAnimating && animationDirection === 'exit' ? 'split-swipe-exit' : ''}`}>
          <div className="flex-1 flex flex-col items-center justify-center">
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
                  <div className="flex-1 w-full">
                    {/* After upload, show editable item summary before continue */}
                    <h3 className="text-responsive-lg font-semibold mb-3">Detected Items</h3>
                    <div className="space-y-2 max-h-[48vh] overflow-y-auto">
                      {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No items detected yet. You can add them manually in the next step.</p>
                      ) : (
                        items.map(it => (
                          <div key={it.id} className="p-3 rounded-lg border border-border/50 flex items-center justify-between">
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
                    <div className="mt-4 flex justify-end">
              </div>
            </div>
                ) : (
                  <label className="btn-primary inline-flex items-center justify-center rounded-md px-5 py-3 cursor-pointer disabled:opacity-70">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && e.target.files[0] && handleImageUpload(e.target.files[0])} />
                    Upload
            </label>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="financial-card p-4 h-[65vh] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Add people</h3>
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
          <div className="flex-1 space-y-2 overflow-y-auto">
            {people.length === 0 && (
              <p className="text-sm text-muted-foreground">No people added yet</p>
            )}
            {people.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                <div className="flex items-center gap-2 min-w-0 cursor-pointer" onClick={() => setExpandedPersonId(prev => prev === p.id ? null : p.id)}>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedPersonId === p.id ? 'rotate-180' : ''}`} />
                  <span className="font-medium truncate">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MoneyDisplay amount={personTotals[p.id]?.total_cents || 0} size="md" animate={false} />
                  {p.id !== myPersonId && (
                    <Button variant="ghost" size="icon" onClick={() => removePerson(p.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="financial-card p-4 h-[65vh] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-lg font-semibold transition-opacity duration-200 ${isEditMode ? 'screen-dim' : ''} ${!isEditMode && !isExitingEditMode ? 'screen-brighten' : ''}`}>Assign items</h3>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleEditModeToggle}
                className={`edit-mode-button ${isEditMode ? 'active' : ''} ${isExitingEditMode ? 'exiting' : ''}`}
              >
                {isEditMode ? 'Done Editing' : 'Edit Mode'}
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
                    <Input type="number" min={0} value={draftItem.price_cents} onChange={(e) => setDraftItem({ ...draftItem, price_cents: Math.max(0, parseInt(e.target.value || '0', 10)) })} />
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
                value={taxServicePercent}
                placeholder="e.g., 10"
                onChange={(e) => setTaxServicePercent(Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
              />
            </div>
            <div className="flex items-end"><div className="text-sm text-muted-foreground">&nbsp;</div></div>
          </div>
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
              const animationDelay = isEditMode ? `${index * 40}ms` : '0ms';
              return (
                <div
                  key={it.id}
                  className={`p-3 rounded-xl border transition-all ${
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
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{it.name}</p>
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
                    <div className="flex items-center justify-center">
                      {/* removed checkbox icon */}
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <div className="w-24 text-right">
                        <MoneyDisplay amount={it.price_cents} size="md" animate={false} />
                      </div>
                      {(isEditMode || isExitingEditMode) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); setEditItemId(it.id); setEditItemPrice(String(it.price_cents)); setIsEditItemOpen(true); }}
                        className={`${isExitingEditMode ? 'edit-icon-exit' : 'edit-icon-enter'} hover:text-foreground ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
                        style={{ animationDelay }}
                        aria-label="Edit price"
                        onMouseEnter={(e) => {
                          if (!isExitingEditMode) {
                            e.currentTarget.classList.add('edit-icon-hover');
                            setTimeout(() => e.currentTarget.classList.remove('edit-icon-hover'), 300);
                          }
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      )}
                      {(isEditMode || isExitingEditMode) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { 
                          if (!isExitingEditMode) {
                            e.stopPropagation(); 
                            e.currentTarget.classList.add('delete-icon-press');
                            setTimeout(() => e.currentTarget.classList.remove('delete-icon-press'), 300);
                            removeItem(it.id); 
                          }
                        }}
                        className={`${isExitingEditMode ? 'delete-icon-exit' : 'delete-icon-enter'} hover:text-destructive ${isSelected ? 'text-primary-foreground/80' : 'text-destructive'}`}
                        style={{ animationDelay }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Summary</h3>
          <div className="space-y-3">
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
        </div>
      )}

      {/* Navigation */}
      {step >= 0 && (
        <div className="flex items-center justify-between w-full px-0 py-2">
          <Button 
            variant="outline" 
            onClick={() => setStep(prev => (prev > 0 ? ((prev - 1) as any) : -1))} 
            disabled={false}
            className="flex items-center gap-2 px-4 py-2"
          >
            <ArrowLeft className="w-4 h-4" /> 
            Back
          </Button>
          
          <div className="flex items-center">
            {step < 3 && (
              <Button
                className="btn-primary px-4 py-2"
                onClick={() => {
                  // Auto-add current user when proceeding from step 1 to step 2
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
                  setStep(prev => (prev + 1) as any);
                }}
                disabled={
                  (step === 1 && !canProceedFromPeople) ||
                  (step === 2 && !allItemsHaveParticipants)
                }
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
            {step === 3 && (
              <Button
                className="btn-primary px-6 py-2"
                onClick={async () => {
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
                    console.error('Error saving split bill:', error);
                    toast({ title: 'Error', description: 'Failed to save split bill. Please try again.' });
                  } finally {
                    setStep(-1);
                  }
                }}
              >
                <ArrowRight className="w-4 h-4 mr-1" />
                Done
              </Button>
            )}
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
