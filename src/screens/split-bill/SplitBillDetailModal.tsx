import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Receipt, Users } from "lucide-react";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SplitBillHistory } from "@/store";

interface SplitBillDetailModalProps {
  splitBill: SplitBillHistory;
  onClose: () => void;
  onPaymentToggle: (billId: string, personId: string, hasPaid: boolean) => void;
}

export const SplitBillDetailModal = ({
  splitBill,
  onClose,
  onPaymentToggle,
}: SplitBillDetailModalProps) => {
  // Debug helper
  const DEBUG = true;
  const lastMoveLogTs = useRef<number>(0);
  const dlog = (...args: any[]) => {
    if (DEBUG) console.debug('[SplitBillDetailModal]', ...args);
  };

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStartY, setDragStartY] = useState<number>(0);
  const [dragCurrentY, setDragCurrentY] = useState<number>(0);
  const [sheetHeight] = useState<number>(80);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [shouldPlayEnter, setShouldPlayEnter] = useState<boolean>(true);

  // Live refs to avoid stale closures in event listeners
  const dragStartYRef = useRef<number>(0);
  const dragCurrentYRef = useRef<number>(0);
  const dragOffsetRef = useRef<number>(0);

  const getInitials = (name: string) => name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();

  const handleDragStart = (clientY: number) => {
    if (isAnimating) return;
    setIsDragging(true);
    setDragStartY(clientY);
    setDragCurrentY(clientY);
    setDragOffset(0);
    dragStartYRef.current = clientY;
    dragCurrentYRef.current = clientY;
    dragOffsetRef.current = 0;
    dlog('dragStart', { clientY });
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging || isAnimating) return;
    setDragCurrentY(clientY);
    dragCurrentYRef.current = clientY;
    
    const startY = dragStartYRef.current;
    const deltaY = clientY - startY;
    
    if (deltaY < 0) {
      setDragOffset(0);
      dragOffsetRef.current = 0;
      const now = performance.now();
      if (now - lastMoveLogTs.current > 80) {
        dlog('dragMove (up ignored)', { clientY, deltaY });
        lastMoveLogTs.current = now;
      }
      return;
    }
    
    // Linear drag (no rubber band)
    const adjustedDelta = Math.max(0, deltaY);
    setDragOffset(adjustedDelta);
    dragOffsetRef.current = adjustedDelta;
    const now = performance.now();
    if (now - lastMoveLogTs.current > 80) {
      dlog('dragMove', { clientY, deltaY, adjustedDelta });
      lastMoveLogTs.current = now;
    }
  };

  const handleDragEnd = () => {
    if (!isDragging || isAnimating) return;
    setIsDragging(false);
    
    const viewportHeight = window.innerHeight;
    const dragDistance = dragOffsetRef.current;
    const dragPercentage = (dragDistance / viewportHeight) * 100;
    
    const thresholdPx = Math.min(120, viewportHeight * 0.25);
    const thresholdPercentage = (thresholdPx / viewportHeight) * 100;
    
    const velocity = dragCurrentYRef.current - dragStartYRef.current;
    const isSwipeDown = velocity > 5;
    dlog('dragEnd', { dragDistance, dragPercentage, thresholdPx, thresholdPercentage, velocity, isSwipeDown });
    
    if (dragPercentage > thresholdPercentage || isSwipeDown) {
      // Animate close: slide the sheet down, then notify parent to unmount
      setIsAnimating(true);
      setDragOffset(viewportHeight);
      dragOffsetRef.current = viewportHeight;
      
      setTimeout(() => {
        dlog('closing after slide-down');
        onClose();
        // Do NOT reset dragOffset to 0 here to avoid re-triggering enter animation if parent keeps it mounted briefly
        setIsAnimating(false);
      }, 400);
    } else {
      setIsAnimating(true);
      setDragOffset(0);
      dragOffsetRef.current = 0;
      
      setTimeout(() => {
        dlog('snap-back to top');
        setIsAnimating(false);
      }, 400);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        handleDragMove(e.clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        e.preventDefault();
        handleDragMove(e.touches[0].clientY);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        handleDragEnd();
      }
    };

    const handleTouchEnd = () => {
      if (isDragging) {
        handleDragEnd();
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  const animateClose = () => {
    if (isAnimating) return;
    const viewportHeight = window.innerHeight;
    setIsAnimating(true);
    setDragOffset(viewportHeight);
    setTimeout(() => {
      dlog('backdrop close');
      onClose();
      setIsAnimating(false);
    }, 400);
  };

  useEffect(() => {
    // Only play the enter animation once on initial mount
    const id = setTimeout(() => setShouldPlayEnter(false), 450);
    dlog('mounted: play enter animation once');
    return () => clearTimeout(id);
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-50"
        onClick={!isDragging && !isAnimating ? animateClose : undefined}
        style={{ 
          animation: 'fadeIn 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          opacity: isDragging 
            ? Math.max(0.2, 0.6 * (1 - dragOffset / window.innerHeight))
            : isAnimating && dragOffset > 0
            ? 0
            : 0.6,
          transition: isAnimating ? 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        }}
      />
      
      {/* Bottom Sheet */}
      <div 
        className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-3xl shadow-2xl overflow-hidden select-none"
        style={{
          height: 'min(80dvh, calc(var(--dvh, 100vh) * 0.8))',
          transform: `translateY(${dragOffset}px)`,
          // Only play the enter animation on first mount
          animation: shouldPlayEnter ? 'slideUp 400ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
          transition: isAnimating 
            ? 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'none',
          willChange: 'transform',
        }}
      >
        {/* Handle Bar - Draggable */}
        <div 
          className="flex justify-center pt-4 pb-3 cursor-grab active:cursor-grabbing touch-none"
          onMouseDown={(e) => {
            e.preventDefault();
            handleDragStart(e.clientY);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            handleDragStart(e.touches[0].clientY);
          }}
        >
          <div 
            className="w-12 h-1.5 bg-muted-foreground/30 rounded-full transition-all duration-200"
            style={{
              transform: isDragging ? 'scaleX(1.5)' : 'scaleX(1)',
              backgroundColor: isDragging ? 'hsl(var(--muted-foreground) / 0.5)' : 'hsl(var(--muted-foreground) / 0.3)',
            }}
          />
        </div>

        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-10 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Split Bill Details</h2>
              <p className="text-sm text-muted-foreground">
                {new Date(splitBill.date).toLocaleDateString()}
              </p>
            </div>
            <MoneyDisplay amount={splitBill.total_amount_cents} size="xl" />
          </div>
        </div>

        {/* Scrollable Content */}
        <div 
          className="overflow-y-auto px-6 py-6 space-y-6" 
          style={{ 
            height: `calc(min(80dvh, calc(var(--dvh, 100vh) * 0.8)) - 120px)`,
            opacity: isDragging ? Math.max(0.5, 1 - (dragOffset / 200)) : 1,
            transition: isAnimating ? 'opacity 400ms ease-out' : 'none',
          }}
        >
          {/* Bill Summary */}
          <Card className="financial-card p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Participants</p>
                <p className="text-2xl font-bold">{splitBill.people.length}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{splitBill.items.length}</p>
              </div>
            </div>
          </Card>

          {/* Items List */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Items
            </h3>
            {splitBill.items.map((item) => (
              <Card key={item.id} className="financial-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.participants.length} participant{item.participants.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <MoneyDisplay amount={item.price_cents} size="md" />
                </div>
              </Card>
            ))}
          </div>

          {/* Payment Status */}
          <div className="space-y-3 pb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Payment Status
            </h3>
            {splitBill.people.map((person) => {
              const hasPaid = (splitBill.payment_status || {})[person.id] || false;
              const personTotal = splitBill.person_totals[person.id]?.total_cents || 0;
              
              return (
                <div 
                  key={person.id} 
                  className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer hover:shadow-md transition-all duration-300 ease-in-out ${
                    hasPaid
                      ? 'bg-primary text-primary-foreground border-primary shadow-md'
                      : 'bg-card border-border/50 hover:border-primary/30 hover:shadow-[var(--shadow-float)]'
                  }`}
                  onClick={() => onPaymentToggle(splitBill.id, person.id, !hasPaid)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      onPaymentToggle(splitBill.id, person.id, !hasPaid);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 ring-2 ring-background">
                      <AvatarFallback className="text-sm font-semibold">{getInitials(person.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{person.name}</p>
                      <p className={`text-sm transition-colors duration-300 ease-in-out ${hasPaid ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {hasPaid ? '✓ Paid' : 'Pending'}
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
        </div>
      </div>
    </>
  );
};

