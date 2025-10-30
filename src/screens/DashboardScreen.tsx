import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { useFinancifyStore } from "@/store";
import { Upload, TrendingUp, TrendingDown, Wallet, ArrowRight, PieChart, Users } from "lucide-react";
import { NavigationTab } from "@/components/Navigation";
import heroImage from "@/assets/financify-hero.jpg";
import { useMemo, useState, useEffect } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { TransactionInputDialog } from "@/components/TransactionInputDialog";

interface DashboardScreenProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const DashboardScreen = ({ onNavigate }: DashboardScreenProps) => {
  const { 
    user, 
    profile,
    getTotalBalance, 
    getMonthlyStats, 
    getRecentTransactions,
    transactions,
    isLoading,
    deleteTransaction,
  } = useFinancifyStore();
  const navigate = useNavigate();

  const totalBalance = getTotalBalance();
  const monthlyStats = getMonthlyStats();
  const recentTransactions = getRecentTransactions();

  const [graphType, setGraphType] = useState<'income' | 'expense'>('income');
  const [chartMonth, setChartMonth] = useState<Date>(new Date());
  const [chartReady, setChartReady] = useState(false);
  const [selectedTransactionDetail, setSelectedTransactionDetail] = useState<any>(null);
  const [isTransactionDetailOpen, setIsTransactionDetailOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<any>(null);
  const monthYearLabel = useMemo(() => chartMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' }), [chartMonth]);

  // Enable chart animation only after data is loaded
  useEffect(() => {
    if (!isLoading && transactions.length >= 0) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setChartReady(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading, transactions.length]);

  const handleEditTransaction = () => {
    setIsTransactionDetailOpen(false);
    setIsEditDialogOpen(true);
  };

  const handleDeleteTransaction = () => {
    setTransactionToDelete(selectedTransactionDetail);
    setIsTransactionDetailOpen(false);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteTransaction = async () => {
    if (!transactionToDelete) return;
    
    try {
      await deleteTransaction(transactionToDelete.id);
      toast({
        title: "Transaction Deleted",
        description: "Transaction has been successfully deleted.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete transaction. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDeleteConfirmOpen(false);
      setTransactionToDelete(null);
    }
  };

  const chartData = useMemo(() => {
    const y = chartMonth.getFullYear();
    const m = chartMonth.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const data = Array.from({ length: daysInMonth }, (_, i) => ({
      day: String(i + 1),
      income: 0,
      expense: 0,
    }));

    // Aggregate this month's transactions per day
    for (const t of transactions) {
      const d = new Date(t.date);
      if (d.getFullYear() === y && d.getMonth() === m) {
        const idx = d.getDate() - 1;
        if (t.type === 'credit') {
          data[idx].income += t.amount_cents;
        } else {
          data[idx].expense += Math.abs(t.amount_cents);
        }
      }
    }

    return data;
  }, [transactions, chartMonth]);

  const chartMax = useMemo(() => {
    let max = 0;
    for (const d of chartData) {
      if (d.income > max) max = d.income;
      if (d.expense > max) max = d.expense;
    }
    return max || 0;
  }, [chartData]);


  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">
          Hello, {profile?.full_name || user?.email?.split('@')[0] || 'User'}! 👋
        </h1>
        <p className="text-muted-foreground">Welcome to your financial dashboard</p>
      </div>

      {/* Total Balance Card */}
      <Card className="financial-card p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            <span className="text-responsive-sm font-medium text-muted-foreground">Total Balance</span>
          </div>
          <MoneyDisplay 
            amount={totalBalance} 
            size="xl" 
            showSign
            className={totalBalance < 0 ? "text-expense" : "text-income"}
          />
          <p className="text-xs text-muted-foreground">
            As of {new Date().toLocaleDateString('id-ID')}
          </p>
        </div>
      </Card>

      {/* Monthly Stats */}
      <div>
        <h2 className="text-responsive-lg font-semibold mb-3">This Month</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            title="Income"
            amount={monthlyStats.income}
            type="income"
            icon={TrendingUp}
            subtitle="This month"
          />
          <StatCard
            title="Expense"
            amount={monthlyStats.expense}
            type="expense"
            icon={TrendingDown}
            subtitle="This month"
          />
          <StatCard
            title="Net"
            amount={monthlyStats.net}
            type={monthlyStats.net >= 0 ? "income" : "expense"}
            subtitle="This month"
          />
        </div>
      </div>

      {/* Cash Flow Chart */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-primary" />
              <Select
              value={`${chartMonth.getFullYear()}-${chartMonth.getMonth()}`}
              onValueChange={(val) => {
                const [y, m] = val.split('-').map(Number);
                setChartMonth(new Date(y, m, 1));
              }}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {(() => {
                  const start = new Date(chartMonth.getFullYear(), chartMonth.getMonth(), 1);
                  return Array.from({ length: 120 }).map((_, idx) => {
                    const d = new Date(start);
                    d.setMonth(start.getMonth() - idx);
                  const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                  return (
                    <SelectItem key={`${d.getFullYear()}-${d.getMonth()}`} value={`${d.getFullYear()}-${d.getMonth()}`}>
                      {label}
                    </SelectItem>
                  );
                  });
                })()}
              </SelectContent>
            </Select>
          </div>
          <ToggleGroup type="single" value={graphType} onValueChange={(v) => v && setGraphType(v as 'income' | 'expense')}>
            <ToggleGroupItem value="income">Income</ToggleGroupItem>
            <ToggleGroupItem value="expense">Expense</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Card className="financial-card p-0 overflow-hidden">
          {isLoading ? (
            <div className="aspect-[16/9] flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-responsive-sm text-muted-foreground">Loading chart data...</p>
              </div>
            </div>
          ) : (
            <ChartContainer
              config={{
                income: { label: 'Income', color: '#16a34a' },
                expense: { label: 'Expense', color: '#ef4444' },
              }}
              className="aspect-[16/9] -m-1"
            >
            <AreaChart data={chartData} margin={{ left: 0, right: 20, top: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="day" 
                tickLine={false} 
                axisLine={false} 
                height={30}
                tick={{ fontSize: 11 }}
              />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                width={50} 
                domain={[0, chartMax]}
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => v >= 1_000_000 ? `${Math.round(v/1_000_000)}M` : v >= 1_000 ? `${Math.round(v/1_000)}K` : `${v}`}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              {graphType === 'income' ? (
                <Area key="income" type="monotone" dataKey="income" stroke="var(--color-income)" fill="var(--color-income)" fillOpacity={0.25}
                  isAnimationActive={chartReady} animationDuration={500} animationEasing="ease-in-out" />
              ) : (
                <Area key="expense" type="monotone" dataKey="expense" stroke="var(--color-expense)" fill="var(--color-expense)" fillOpacity={0.25}
                  isAnimationActive={chartReady} animationDuration={500} animationEasing="ease-in-out" />
              )}
            </AreaChart>
            </ChartContainer>
          )}
        </Card>
      </div>



      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-responsive-lg font-semibold">Recent Activity</h2>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onNavigate('reports')}
          >
            View All
          </Button>
        </div>
        
        {recentTransactions.length > 0 ? (
          <div className="space-y-2">
            {recentTransactions.map((transaction) => {
              // Format amount without currency
              const formatAmountNoCurrency = (amount: number) => {
                return new Intl.NumberFormat('id-ID', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(Math.abs(amount));
              };
              
              const getAmountColor = () => {
                return transaction.type === 'credit' ? "text-income" : "text-expense";
              };
              
              // Truncate description to max 35 characters
              const truncateDescription = (text: string, maxLength: number = 35) => {
                if (text.length <= maxLength) return text;
                return text.substring(0, maxLength) + '...';
              };
              
              return (
                <Card 
                  key={transaction.id} 
                  className="financial-card p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => {
                    setSelectedTransactionDetail(transaction);
                    setIsTransactionDetailOpen(true);
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium truncate flex-1 mr-2">{truncateDescription(transaction.description)}</p>
                    <p className={`font-bold whitespace-nowrap ${getAmountColor()}`}>
                      {formatAmountNoCurrency(transaction.amount_cents)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <p className="truncate">{transaction.category}</p>
                    <p className="whitespace-nowrap ml-2">{new Date(transaction.date).toLocaleDateString('id-ID')}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="financial-card p-8 text-center">
            <div className="space-y-2">
              <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">No transactions yet</p>
              <p className="text-responsive-sm text-muted-foreground">Import your first bank statement to get started</p>
            </div>
          </Card>
        )}
      </div>

      {/* Transaction Detail Dialog */}
      {selectedTransactionDetail && (
        <Dialog open={isTransactionDetailOpen} onOpenChange={setIsTransactionDetailOpen}>
          <DialogContent className="max-w-md w-[90%] sm:w-full rounded-2xl">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Type Badge */}
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedTransactionDetail.type === 'credit' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {selectedTransactionDetail.type === 'credit' ? 'Income' : 'Expense'}
                </span>
              </div>

              {/* Description */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="font-medium text-base break-words">{selectedTransactionDetail.description}</p>
              </div>

              {/* Amount */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Amount</p>
                <p className={`text-2xl font-bold ${
                  selectedTransactionDetail.type === 'credit' ? 'text-income' : 'text-expense'
                }`}>
                  {new Intl.NumberFormat('id-ID', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(Math.abs(selectedTransactionDetail.amount_cents))}
                </p>
              </div>

              {/* Category */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Category</p>
                <p className="font-medium">{selectedTransactionDetail.category}</p>
              </div>

              {/* Source */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Source</p>
                <p className="font-medium">{selectedTransactionDetail.source}</p>
              </div>

              {/* Date */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Date</p>
                <p className="font-medium">{new Date(selectedTransactionDetail.date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <Button
                  onClick={handleEditTransaction}
                  className="flex-1 rounded-full border-2 bg-background text-foreground border-muted hover:bg-muted transition-colors"
                >
                  Edit
                </Button>
                <Button
                  onClick={handleDeleteTransaction}
                  className="flex-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Delete
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Transaction Dialog */}
      <TransactionInputDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        initialTransaction={selectedTransactionDetail}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete this transaction? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 rounded-full"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeleteTransaction}
                className="flex-1 rounded-full bg-red-500 text-white hover:bg-red-600"
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};