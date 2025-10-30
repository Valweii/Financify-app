import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Pencil, Trash2, Receipt } from "lucide-react";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { Item } from "@/types/split-bill";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface UploadReceiptScreenProps {
  imagePreview: string | null;
  isOcrLoading: boolean;
  items: Item[];
  onImageUpload: (file: File) => Promise<void>;
  onBack: () => void;
  onContinue: () => void;
  onEditItem: (itemId: string, newPrice: number) => void;
  onRemoveItem: (itemId: string) => void;
  progressAnimation: 'forward' | 'backward' | null;
  progressFrom: number;
  progressTo: number;
}

export const UploadReceiptScreen = ({
  imagePreview,
  isOcrLoading,
  items,
  onImageUpload,
  onBack,
  onContinue,
  onEditItem,
  onRemoveItem,
  progressAnimation,
  progressFrom,
  progressTo,
}: UploadReceiptScreenProps) => {
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editItemPrice, setEditItemPrice] = useState<string>("0");

  const handleSaveEdit = () => {
    const v = Math.max(0, parseInt(editItemPrice || '0', 10));
    if (editItemId) {
      onEditItem(editItemId, v);
    }
    setIsEditItemOpen(false);
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="space-y-2">
        <h1 className="text-responsive-2xl font-bold">Split Bill</h1>
        <p className="text-muted-foreground">Step 1 of 4</p>
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
                  width: progressAnimation ? 'var(--progress-to)' : '25%',
                  '--progress-from': `${progressFrom}%`,
                  '--progress-to': `${progressTo}%`
                } as React.CSSProperties}
              ></div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1">Step 1 of 4</p>
          </div>
          <div className="w-16"></div>
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
                                onClick={() => { 
                                  setEditItemId(it.id); 
                                  setEditItemPrice(String(it.price_cents)); 
                                  setIsEditItemOpen(true); 
                                }}
                                aria-label="Edit price"
                                className="transition-transform duration-150 active:scale-95"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onRemoveItem(it.id)}
                                className="text-destructive transition-transform duration-150 active:scale-95"
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
                      onClick={onContinue}
                      className="w-full btn-primary transition-transform duration-150 hover:scale-[.98] active:scale-95"
                      disabled={items.length === 0}
                    >
                      Continue to People
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button 
                      onClick={onContinue}
                      variant="outline"
                      className="w-full transition-all duration-200 active:scale-95"
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
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => e.target.files && e.target.files[0] && onImageUpload(e.target.files[0])} 
                        />
                        Choose Receipt
                      </label>
                    </div>
                  </div>
                  
                  {/* Skip option */}
                  <div className="text-center">
                    <Button 
                      onClick={onContinue}
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-95"
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

      {/* Edit Item Dialog */}
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
            <Button onClick={handleSaveEdit} className="btn-primary">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

