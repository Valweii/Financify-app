import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, ChevronDown, ImagePlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { toast } from "@/components/ui/use-toast";
import { parseReceiptImage } from "@/lib/receipt-ocr";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";

// Local types for split bill
type Person = { id: string; name: string };

type Item = {
  id: string;
  name: string;
  price_cents: number;
  participants: string[]; // person ids
};

export const SplitBillScreen = () => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [taxChoice, setTaxChoice] = useState<'none' | '10' | '11'>('none');
  const [serviceFeeCents, setServiceFeeCents] = useState<number>(0);
  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [assignPersonId, setAssignPersonId] = useState<string | null>(null);

  const [newPersonName, setNewPersonName] = useState("");
  const [draftItem, setDraftItem] = useState<{ name: string; price_cents: number; participants: string[] }>({ name: "", price_cents: 0, participants: [] });

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
      } catch (e) {
        console.error(e);
        toast({ title: "OCR failed", description: "Could not read text from image. Please add items manually." });
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
    if (!name || draftItem.price_cents <= 0 || draftItem.participants.length === 0) return;
    setItems(prev => [...prev, { id: crypto.randomUUID(), name, price_cents: draftItem.price_cents, participants: draftItem.participants }]);
    setDraftItem({ name: "", price_cents: 0, participants: [] });
    setIsAddItemOpen(false);
  };

  const removePerson = (id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id));
    setItems(prev => prev.map(it => ({ ...it, participants: it.participants.filter(pid => pid !== id) })));
    if (expandedPersonId === id) setExpandedPersonId(null);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(it => it.id !== id));

  const toggleParticipant = (personId: string) => {
    setDraftItem(prev => ({
      ...prev,
      participants: prev.participants.includes(personId)
        ? prev.participants.filter(id => id !== personId)
        : [...prev.participants, personId]
    }));
  };

  const togglePersonInItem = (itemId: string, personId: string) => {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it;
      const isIn = it.participants.includes(personId);
      return { ...it, participants: isIn ? it.participants.filter(id => id !== personId) : [...it.participants, personId] };
    }));
  };

  const getInitials = (name: string) => name.split(" ").map(s => s[0]).join("").slice(0,2).toUpperCase();

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

    // 1) Split service fee equally across ALL people regardless of spending
    if (serviceFeeCents > 0 && entries.length > 0) {
      const baseShare = Math.floor(serviceFeeCents / entries.length);
      let remainder = serviceFeeCents - baseShare * entries.length;
      entries.forEach(([_, t]) => {
        t.service_cents = baseShare + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
      });
    }

    // 2) Compute tax AFTER service fee is added, and distribute proportionally to (subtotal + service)
    const taxPct = taxChoice === '10' ? 10 : taxChoice === '11' ? 11 : 0;
    if (taxPct > 0 && (subtotalSum + serviceFeeCents) > 0) {
      const perPersonBase = entries.map(([pid, t]) => ({ pid, base: (t.subtotal_cents || 0) + (t.service_cents || 0) }));
      const totalBase = perPersonBase.reduce((s, x) => s + x.base, 0);
      const taxTotal = Math.round(totalBase * taxPct / 100);
      let allocated = 0;
      perPersonBase.forEach((x, idx) => {
        const share = idx === perPersonBase.length - 1 ? Math.max(0, taxTotal - allocated) : Math.round((x.base / totalBase) * taxTotal);
        totals[x.pid].tax_cents = share;
        allocated += share;
      });
    }

    Object.values(totals).forEach(t => {
      t.total_cents = (t.subtotal_cents || 0) + (t.service_cents || 0) + (t.tax_cents || 0);
    });

    return totals;
  }, [people, items, taxChoice, serviceFeeCents]);

  const canProceedFromPeople = people.length > 0;
  const allItemsHaveParticipants = items.length > 0 && items.every(it => it.participants.length > 0);

  // Ensure a selected person exists for assignment step
  if (step === 2 && !assignPersonId && people.length > 0) {
    setAssignPersonId(people[0].id);
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Split Bill</h1>
        <p className="text-muted-foreground">Step {step + 1} of 4</p>
      </div>

      {step === 0 && (
        <Card className="financial-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImagePlus className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">Upload receipt (optional)</p>
                <p className="text-sm text-muted-foreground">We’ll try to detect items automatically</p>
              </div>
            </div>
            <label className="btn-primary inline-flex items-center justify-center rounded-md px-3 py-2 cursor-pointer disabled:opacity-70" title={isOcrLoading ? 'Processing...' : undefined}>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && e.target.files[0] && handleImageUpload(e.target.files[0])} />
              {isOcrLoading ? 'Processing...' : 'Upload'}
            </label>
          </div>
          {imagePreview && (
            <img src={imagePreview} alt="Receipt preview" className="mt-3 rounded-lg border border-border/50 max-h-64 object-contain" />
          )}
        </Card>
      )}

      {step === 1 && (
        <Card className="financial-card p-4">
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
          <div className="space-y-2">
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
                  <MoneyDisplay amount={personTotals[p.id]?.total_cents || 0} size="md" />
                  <Button variant="ghost" size="icon" onClick={() => removePerson(p.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="financial-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Assign items</h3>
            <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="btn-primary"><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
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
                  <div>
                    <label className="text-sm text-muted-foreground">Participants</label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto">
                      {people.map(p => (
                        <label key={p.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={draftItem.participants.includes(p.id)} onChange={() => toggleParticipant(p.id)} />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={addItem} className="btn-primary">Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {/* Participant selector */}
          <div className="mb-3">
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {people.map(p => (
                <button
                  key={p.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm hover:shadow transition-all ${assignPersonId === p.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground bg-card'}`}
                  onClick={() => setAssignPersonId(p.id)}
                >
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted/60 text-xs font-medium">
                    {getInitials(p.name)}
                  </span>
                  <span className="text-sm">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Tax & Service controls */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-sm text-muted-foreground">Tax</label>
              <Select value={taxChoice} onValueChange={(v) => setTaxChoice(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="11">11%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Service Fee (IDR)</label>
              <Input
                type="number"
                min={0}
                value={serviceFeeCents}
                onChange={(e) => setServiceFeeCents(Math.max(0, parseInt(e.target.value || '0', 10)))}
              />
            </div>
          </div>
          {/* Selected person's running total */}
          {assignPersonId && (
            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 mb-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{getInitials(people.find(p=>p.id===assignPersonId)?.name || '')}</AvatarFallback></Avatar>
                <span className="text-sm text-muted-foreground">Selected</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground mr-2">Subtotal</span>
                <MoneyDisplay amount={(personTotals[assignPersonId]?.subtotal_cents)||0} size="sm" />
              </div>
            </div>
          )}
          {/* Quick actions */}
          <div className="space-y-2">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">No items yet</p>
            )}
            {items.map(it => {
              const isSelected = Boolean(assignPersonId && it.participants.includes(assignPersonId));
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
                      <p className={`text-sm truncate ${isSelected ? 'opacity-90' : 'text-muted-foreground'}`}>Participants: {it.participants.map(pid => people.find(p => p.id === pid)?.name || 'Unknown').join(', ') || 'None'}</p>
                    </div>
                    <div className="flex items-center justify-center">
                      {assignPersonId && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            aria-label="Toggle participant for item"
                            checked={it.participants.includes(assignPersonId)}
                            onCheckedChange={() => togglePersonInItem(it.id, assignPersonId)}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <div className="w-24 text-right">
                        <MoneyDisplay amount={it.price_cents} size="md" />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); removeItem(it.id); }}
                        className={`hover:text-destructive ${isSelected ? 'text-primary-foreground/80' : 'text-destructive'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="financial-card p-4">
          <h3 className="text-lg font-semibold mb-3">Summary</h3>
          <div className="space-y-2">
            {people.map(p => {
              const details = personTotals[p.id];
              return (
                <div key={p.id} className="p-3 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 cursor-pointer" onClick={() => setExpandedPersonId(prev => prev === p.id ? null : p.id)}>
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedPersonId === p.id ? 'rotate-180' : ''}`} />
                      <span className="font-medium truncate">{p.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Subtotal</div>
                      <MoneyDisplay amount={details?.subtotal_cents || 0} size="sm" />
                      {(details?.tax_cents || 0) > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">+ Tax <MoneyDisplay amount={details?.tax_cents || 0} size="sm" /></div>
                      )}
                      <div className="font-medium mt-1"><MoneyDisplay amount={details?.total_cents || 0} size="md" /></div>
                    </div>
                  </div>
                  <div className={`overflow-hidden transition-all duration-300 ${expandedPersonId === p.id ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
                    {expandedPersonId === p.id && (
                      <div className="pt-2 mt-2 border-t border-border/50 space-y-1">
                        {details?.shares.length ? details.shares.map(s => (
                          <div key={s.itemId} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground truncate pr-2">{s.name}</span>
                            <MoneyDisplay amount={s.share_cents} size="sm" />
                          </div>
                        )) : (
                          <p className="text-sm text-muted-foreground">No assigned items</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep(prev => (prev > 0 ? ((prev - 1) as any) : prev))} disabled={step === 0}>Back</Button>
        <div className="flex items-center gap-2">
          {step < 3 && (
            <Button
              className="btn-primary"
              onClick={() => setStep(prev => (prev + 1) as any)}
              disabled={
                (step === 1 && !canProceedFromPeople) ||
                (step === 2 && !allItemsHaveParticipants)
              }
            >
              Next
            </Button>
          )}
          {step === 3 && (
            <Button className="btn-primary" onClick={() => setStep(0)}>Done</Button>
          )}
        </div>
      </div>
    </div>
  );
};
