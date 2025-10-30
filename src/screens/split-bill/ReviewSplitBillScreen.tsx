import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { Person, PersonTotals } from "@/types/split-bill";

interface ReviewSplitBillScreenProps {
  people: Person[];
  personTotals: PersonTotals;
  isProcessing: boolean;
  onBack: () => void;
  onComplete: () => Promise<void>;
  progressAnimation: 'forward' | 'backward' | null;
  progressFrom: number;
  progressTo: number;
}

export const ReviewSplitBillScreen = ({
  people,
  personTotals,
  isProcessing,
  onBack,
  onComplete,
  progressAnimation,
  progressFrom,
  progressTo,
}: ReviewSplitBillScreenProps) => {
  return (
    <div className="flex flex-col space-y-6">
      <div className="space-y-2">
        <h1 className="text-responsive-2xl font-bold">Split Bill</h1>
        <p className="text-muted-foreground">Step 4 of 4</p>
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
                  width: progressAnimation ? 'var(--progress-to)' : '100%',
                  '--progress-from': `${progressFrom}%`,
                  '--progress-to': `${progressTo}%`
                } as React.CSSProperties}
              ></div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1">Step 4 of 4</p>
          </div>
          <div className="w-16"></div>
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
                      <div className="font-semibold text-lg">
                        <MoneyDisplay amount={details?.total_cents || 0} size="lg" animate={false} />
                      </div>
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
            className="w-full btn-primary transition-transform duration-150 hover:scale-[.98] active:scale-95"
            disabled={isProcessing}
            onClick={onComplete}
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
    </div>
  );
};

