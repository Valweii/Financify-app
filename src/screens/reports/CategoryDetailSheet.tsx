import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowUpDown } from "lucide-react";

type Transaction = {
  id: string;
  description: string;
  type: 'credit' | 'debit';
  amount_cents: number;
  category: string;
  source?: string;
  date: string;
};

interface CategoryDetailSheetProps {
  selectedCategory: string;
  monthlyDate: Date;
  monthlyTransactions: Transaction[];
  sortBy: 'date' | 'amount';
  sortDir: 'asc' | 'desc';
  setSortBy: (v: 'date' | 'amount') => void;
  setSortDir: (v: 'asc' | 'desc') => void;
  onClose: () => void;
  onOpenTransaction: (t: Transaction) => void;
}

export const CategoryDetailSheet = ({
  selectedCategory,
  monthlyDate,
  monthlyTransactions,
  sortBy,
  sortDir,
  setSortBy,
  setSortDir,
  onClose,
  onOpenTransaction,
}: CategoryDetailSheetProps) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [shouldPlayEnter, setShouldPlayEnter] = useState<boolean>(true);

  const dragStartYRef = useRef<number>(0);
  const dragCurrentYRef = useRef<number>(0);
  const dragOffsetRef = useRef<number>(0);

  const handleDragStart = (clientY: number) => {
    if (isAnimating) return;
    setIsDragging(true);
    dragStartYRef.current = clientY;
    dragCurrentYRef.current = clientY;
    setDragOffset(0);
    dragOffsetRef.current = 0;
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging || isAnimating) return;
    dragCurrentYRef.current = clientY;
    const deltaY = clientY - dragStartYRef.current;
    if (deltaY < 0) {
      setDragOffset(0);
      dragOffsetRef.current = 0;
      return;
    }
    // Linear drag (no rubber band)
    const adjustedDelta = Math.max(0, deltaY);
    setDragOffset(adjustedDelta);
    dragOffsetRef.current = adjustedDelta;
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

    if (dragPercentage > thresholdPercentage || isSwipeDown) {
      setIsAnimating(true);
      setDragOffset(viewportHeight);
      dragOffsetRef.current = viewportHeight;
      setTimeout(() => {
        onClose();
        setIsAnimating(false);
      }, 400);
    } else {
      setIsAnimating(true);
      setDragOffset(0);
      dragOffsetRef.current = 0;
      setTimeout(() => setIsAnimating(false), 400);
    }
  };

  const animateClose = () => {
    if (isAnimating) return;
    const viewportHeight = window.innerHeight;
    setIsAnimating(true);
    setDragOffset(viewportHeight);
    setTimeout(() => {
      onClose();
      setIsAnimating(false);
    }, 400);
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
    const handleMouseUp = () => { if (isDragging) handleDragEnd(); };
    const handleTouchEnd = () => { if (isDragging) handleDragEnd(); };
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

  useEffect(() => {
    const id = setTimeout(() => setShouldPlayEnter(false), 450);
    return () => clearTimeout(id);
  }, []);

  const filteredSorted = monthlyTransactions
    .filter(t => t.category === selectedCategory)
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'date') {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        return (da - db) * dir;
      } else {
        const aa = Math.abs(a.amount_cents);
        const bb = Math.abs(b.amount_cents);
        return (aa - bb) * dir;
      }
    });

  const formatAmountNoCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(amount));

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
          height: '80vh',
          transform: `translateY(${dragOffset}px)`,
          animation: shouldPlayEnter ? 'slideUp 400ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
          transition: isAnimating 
            ? 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'none',
          willChange: 'transform',
        }}
      >
        {/* Handle Bar */}
        <div 
          className="flex justify-center pt-4 pb-3 cursor-grab active:cursor-grabbing touch-none"
          onMouseDown={(e) => { e.preventDefault(); handleDragStart(e.clientY); }}
          onTouchStart={(e) => { e.preventDefault(); handleDragStart(e.touches[0].clientY); }}
        >
          <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full transition-all duration-200" />
        </div>

        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border px-4 py-4 rounded-t-3xl z-10 flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold truncate">{selectedCategory}</h2>
              <p className="text-sm text-muted-foreground truncate">
                {monthlyTransactions.filter(t => t.category === selectedCategory).length} transaction
                {monthlyTransactions.filter(t => t.category === selectedCategory).length !== 1 ? 's' : ''} • {monthlyDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center bg-secondary rounded-full p-1.5">
                <button
                  onClick={() => setSortBy('date')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                    sortBy === 'date' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Date
                </button>
                <button
                  onClick={() => setSortBy('amount')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                    sortBy === 'amount' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Amount
                </button>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full h-8 w-8"
                onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
              >
                <ArrowUpDown className={`w-4 h-4 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4" style={{ height: 'calc(80vh - 90px)' }}>
          <div className="space-y-2 pb-20 w-full">
            {filteredSorted.map((transaction) => (
              <Card 
                key={transaction.id} 
                className="financial-card p-4 overflow-hidden cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => onOpenTransaction(transaction)}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="font-medium truncate flex-1 min-w-0">{transaction.description.length <= 35 ? transaction.description : transaction.description.substring(0, 35) + '...'}</p>
                  <p className={`font-bold whitespace-nowrap flex-shrink-0 ${transaction.type === 'credit' ? 'text-income' : 'text-expense'}`}>
                    {formatAmountNoCurrency(transaction.amount_cents)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <p className="truncate flex-1 min-w-0">{transaction.source}</p>
                  <p className="whitespace-nowrap flex-shrink-0">{new Date(transaction.date).toLocaleDateString('en-US')}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};


