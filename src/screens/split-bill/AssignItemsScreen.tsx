import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, Plus, Trash2, Pencil } from "lucide-react";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Person, Item, PersonTotals } from "@/types/split-bill";

interface AssignItemsScreenProps {
  people: Person[];
  items: Item[];
  taxServicePercent: number;
  personTotals: PersonTotals;
  totalBillAmount: number;
  assignPersonId: string | null;
  onAddItem: (name: string, priceCents: number) => void;
  onRemoveItem: (id: string) => void;
  onEditItem: (itemId: string, newPrice: number) => void;
  onTogglePersonInItem: (itemId: string, personId: string) => void;
  onSetTaxServicePercent: (percent: number) => void;
  onSetAssignPersonId: (personId: string | null) => void;
  onBack: () => void;
  onContinue: () => void;
  progressAnimation: 'forward' | 'backward' | null;
  progressFrom: number;
  progressTo: number;
}

export const AssignItemsScreen = ({
  people,
  items,
  taxServicePercent,
  personTotals,
  totalBillAmount,
  assignPersonId,
  onAddItem,
  onRemoveItem,
  onEditItem,
  onTogglePersonInItem,
  onSetTaxServicePercent,
  onSetAssignPersonId,
  onBack,
  onContinue,
  progressAnimation,
  progressFrom,
  progressTo,
}: AssignItemsScreenProps) => {
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editItemPrice, setEditItemPrice] = useState<string>("0");
  const [draftItem, setDraftItem] = useState<{ name: string; price_cents: number }>({ name: "", price_cents: 0 });
  
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isExitingEditMode, setIsExitingEditMode] = useState<boolean>(false);
  const [microInteractionInProgress, setMicroInteractionInProgress] = useState<boolean>(false);
  const [showEditIcons, setShowEditIcons] = useState<boolean>(false);
  const [animationKey, setAnimationKey] = useState<number>(0);

  const getInitials = (name: string) => name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();

  const handleAddItem = () => {
    const name = draftItem.name.trim();
    if (!name || draftItem.price_cents <= 0) return;
    onAddItem(name, draftItem.price_cents);
    setDraftItem({ name: "", price_cents: 0 });
    setIsAddItemOpen(false);
  };

  const handleSaveEditItem = () => {
    const v = Math.max(0, parseInt(editItemPrice || '0', 10));
    if (editItemId) {
      onEditItem(editItemId, v);
    }
    setIsEditItemOpen(false);
  };

  const handleEditModeToggle = () => {
    if (isExitingEditMode) return;
    
    if (isEditMode) {
      const editButtons = document.querySelectorAll('button[aria-label="Edit price"]');
      const deleteButtons = document.querySelectorAll('button[aria-label="Delete item"]');
      editButtons.forEach(btn => (btn as HTMLElement).style.transform = '');
      deleteButtons.forEach(btn => (btn as HTMLElement).style.transform = '');
      
      setIsExitingEditMode(true);
      setAnimationKey(prev => prev + 1);
      
      setTimeout(() => {
        setShowEditIcons(false);
        setTimeout(() => {
          setIsEditMode(false);
          setIsExitingEditMode(false);
        }, 50);
      }, 400);
    } else {
      setIsEditMode(true);
      setShowEditIcons(true);
      setAnimationKey(prev => prev + 1);
    }
  };

  // Ensure a selected person exists for assignment step
  useEffect(() => {
    if (!assignPersonId && people.length > 0) {
      onSetAssignPersonId(people[0].id);
    }
  }, [assignPersonId, people, onSetAssignPersonId]);

  return (
    <div className="flex flex-col space-y-6">
      <div className="space-y-2">
        <h1 className="text-responsive-2xl font-bold">Split Bill</h1>
        <p className="text-muted-foreground">Step 3 of 4</p>
      </div>

      <div className="space-y-6">
        {/* Header with back button and progress */}
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-95"
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
          <div className="w-16"></div>
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
                  className={`transition-all duration-300 ease-in-out active:scale-95 ${
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
                    <Button variant="outline" size="sm" className="transition-transform duration-150 active:scale-95">
                      <Plus className="w-4 h-4 mr-1" /> Add Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Item</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                      <div>
                        <label className="text-sm text-muted-foreground">Item Name</label>
                        <Input 
                          value={draftItem.name} 
                          onChange={(e) => setDraftItem({ ...draftItem, name: e.target.value })} 
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Price (IDR)</label>
                        <Input 
                          type="number" 
                          min={0} 
                          value={draftItem.price_cents || ''} 
                          placeholder="0" 
                          onChange={(e) => setDraftItem({ ...draftItem, price_cents: Math.max(0, parseInt(e.target.value || '0', 10)) })} 
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddItem} className="btn-primary transition-transform duration-150 active:scale-95">Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Participant selector (avatars) */}
            <div className="mb-3">
              <div className="flex items-center gap-2 py-1 overflow-x-auto scrollbar-hide">
                {people.map(p => (
                  <button
                    key={p.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm hover:shadow transition-all ${
                      assignPersonId === p.id 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'border-border text-foreground bg-card'
                    }`}
                    onClick={() => onSetAssignPersonId(p.id)}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px]">{getInitials(p.name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs max-w-[72px] truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tax & Service controls */}
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
                  onChange={(e) => onSetTaxServicePercent(Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
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
                  <div className="text-sm font-medium">
                    {people.find(p => p.id === assignPersonId)?.name || 'Current participant'} current total
                  </div>
                  <MoneyDisplay amount={personTotals[assignPersonId]?.total_cents || 0} size="md" animate={false} />
                </div>
              </div>
            )}

            {/* Items list */}
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
                      onClick={() => assignPersonId && onTogglePersonInItem(it.id, assignPersonId)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if ((e.key === ' ' || e.key === 'Enter') && assignPersonId) {
                          e.preventDefault();
                          onTogglePersonInItem(it.id, assignPersonId);
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
                          <div className="w-28 text-right whitespace-nowrap tabular-nums">
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
                          className={`h-8 w-8 rounded-md bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 dark:text-yellow-400 transition-[background-color,transform] duration-200 active:scale-95 ${
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
                              onRemoveItem(it.id); 
                            }
                          }}
                          className={`h-8 w-8 rounded-md bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 transition-[background-color,transform] duration-200 active:scale-95 ${
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
                  <Button onClick={handleSaveEditItem} className="btn-primary">Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Card>

          {/* Continue button */}
          <Button 
            onClick={onContinue}
            className="w-full btn-primary transition-transform duration-150 hover:scale-[.98] active:scale-95"
            disabled={items.length === 0 || items.some(it => it.participants.length === 0)}
          >
            Continue to Review
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

