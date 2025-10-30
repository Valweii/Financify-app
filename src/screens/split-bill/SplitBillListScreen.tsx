import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Plus, History, Eye } from "lucide-react";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { SplitBillHistory } from "@/store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface SplitBillListScreenProps {
  splitBillHistory: SplitBillHistory[];
  onStartNewBill: () => void;
  onViewBillDetail: (bill: SplitBillHistory) => void;
}

export const SplitBillListScreen = ({ 
  splitBillHistory, 
  onStartNewBill,
  onViewBillDetail 
}: SplitBillListScreenProps) => {
  return (
    <div className="flex flex-col space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Split Bill</h1>
        <p className="text-muted-foreground">Track shared expenses with friends</p>
      </div>

      <div className="space-y-6">
        {/* Add New Split Bill Card with Striped Border */}
        <Card 
          className="financial-card p-0 cursor-pointer hover:shadow-lg transition-all overflow-hidden relative group"
          onClick={onStartNewBill}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onStartNewBill();
            }
          }}
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              hsl(var(--primary) / 0.05),
              hsl(var(--primary) / 0.05) 10px,
              hsl(var(--primary) / 0.1) 10px,
              hsl(var(--primary) / 0.1) 20px
            )`,
            border: '2px dashed hsl(var(--primary) / 0.3)',
          }}
        >
          <div className="p-8 flex flex-col items-center justify-center gap-3 min-h-[140px]">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="text-responsive-lg font-semibold">Add New Split Bill</h3>
              <p className="text-muted-foreground text-sm">Start a new bill splitting session</p>
            </div>
          </div>
        </Card>

        {/* Active Split Bills Section */}
        <div className="space-y-4">
          {splitBillHistory.length === 0 ? (
            <Card className="financial-card p-8 text-center">
              <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No active split bills yet</p>
              <p className="text-sm text-muted-foreground">Start splitting bills to see them here</p>
            </Card>
          ) : (
            <>
              {/* <h2 className="text-xl font-semibold">Active Split Bills</h2> */}
              {splitBillHistory.map((history) => {
                const paidCount = Object.values(history.payment_status || {}).filter(Boolean).length;
                const totalCount = history.people.length;
                
                return (
                  <Card 
                    key={history.id} 
                    className="financial-card p-4 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => onViewBillDetail(history)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onViewBillDetail(history);
                      }
                    }}
                  >
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

                    <div className="mt-4 pt-3 border-t flex items-center justify-center gap-2 text-primary">
                      <Eye className="w-4 h-4" />
                      <span className="text-sm font-medium">View Details</span>
                    </div>
                  </Card>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

