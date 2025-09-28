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
import { useNavigate } from "react-router-dom";

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
  } = useFinancifyStore();
  const navigate = useNavigate();

  const totalBalance = getTotalBalance();
  const monthlyStats = getMonthlyStats();
  const recentTransactions = getRecentTransactions();

  const [graphType, setGraphType] = useState<'income' | 'expense'>('income');
  const [chartMonth, setChartMonth] = useState<Date>(new Date());
  const [chartReady, setChartReady] = useState(false);
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
          data[idx].expense += t.amount_cents;
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
        <h1 className="text-responsive-2xl font-bold text-foreground">
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
              <SelectTrigger className="w-56">
                <SelectValue placeholder={monthYearLabel} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {Array.from({ length: 120 }).map((_, idx) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - idx);
                  const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                  return (
                    <SelectItem key={`${d.getFullYear()}-${d.getMonth()}`} value={`${d.getFullYear()}-${d.getMonth()}`}>
                      {label}
                    </SelectItem>
                  );
                })}
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
            {recentTransactions.map((transaction) => (
              <Card key={transaction.id} className="financial-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{transaction.description}</p>
                    <p className="text-responsive-sm text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString('id-ID')} • {transaction.category}
                    </p>
                  </div>
                  <MoneyDisplay 
                    amount={transaction.type === 'credit' ? transaction.amount_cents : -transaction.amount_cents}
                    showSign
                    size="md"
                    animate={false}
                  />
                </div>
              </Card>
            ))}
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
    </div>
  );
};