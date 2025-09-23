import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { useFinancifyStore, ImportedTransaction } from "@/store";
import { Calendar, TrendingUp, TrendingDown, PieChart, Plus, Trash2, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";


export const ReportsScreen = () => {
  const { transactions, createTransaction, deleteTransaction } = useFinancifyStore();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthlyDate, setMonthlyDate] = useState(new Date());
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<ImportedTransaction & { date: string }>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    type: 'debit',
    amount_cents: 0,
    category: 'Other',
  });
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);
  const categoryOptions = useMemo(() => {
    const defaults = ['Income', 'Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Education', 'Savings', 'Other'];
    const set = new Set<string>(defaults);
    transactions.forEach(t => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [transactions]);
  const [monthlySortBy, setMonthlySortBy] = useState<'date' | 'amount'>('date');
  const [monthlySortDir, setMonthlySortDir] = useState<'asc' | 'desc'>('desc');

  // Helper: format date as YYYY-MM-DD in local time (no timezone shift)
  const formatDateLocal = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Calculate daily stats
  const getDailyStats = (date: Date) => {
    const dateString = formatDateLocal(date);
    const dayTransactions = transactions.filter(t => t.date === dateString);
    
    const income = dayTransactions
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount_cents, 0);
      
    const expense = dayTransactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount_cents, 0);

    return { income, expense, net: income - expense, transactions: dayTransactions };
  };

  // Calculate monthly stats by category and expose helpers
  const { monthlyTransactions, categoryStats } = useMemo(() => {
    const currentMonth = monthlyDate.getMonth();
    const currentYear = monthlyDate.getFullYear();

    const monthlyTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getMonth() === currentMonth && 
             transactionDate.getFullYear() === currentYear;
    });

    const categoryStatsMap = monthlyTransactions.reduce((acc, t) => {
      if (!acc[t.category]) {
        acc[t.category] = { income: 0, expense: 0, count: 0 };
      }
      if (t.type === 'credit') {
        acc[t.category].income += t.amount_cents;
      } else {
        acc[t.category].expense += t.amount_cents;
      }
      acc[t.category].count += 1;
      return acc;
    }, {} as Record<string, { income: number; expense: number; count: number }>);

    const categoryStats = Object.entries(categoryStatsMap).map(([category, stats]) => ({
      category,
      ...stats,
      total: stats.income - stats.expense
    }));

    return { monthlyTransactions, categoryStats };
  }, [transactions, monthlyDate, expandedCategory]);

  const dailyStats = getDailyStats(selectedDate);

  const formatDateForInput = (date: Date) => {
    return formatDateLocal(date);
  };

  const monthYearLabel = useMemo(() => monthlyDate.toLocaleString('en-US', { month: 'long', year: 'numeric' }), [monthlyDate]);
  const transactionDateFormat = 'en-US';
  const changeMonth = (delta: number) => {
    const d = new Date(monthlyDate);
    d.setMonth(d.getMonth() + delta);
    setMonthlyDate(d);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground">Analyze your spending patterns</p>
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-secondary">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        
        <TabsContent value="daily" className="space-y-6 mt-6">
          {/* Daily Selector with improved UX */}
          <Card className="financial-card p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary" />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 1))} aria-label="Previous day">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Select
                  value={formatDateForInput(selectedDate)}
                  onValueChange={(val) => {
                    const [yy, mm, dd] = val.split('-').map(Number);
                    setSelectedDate(new Date(yy, mm - 1, dd));
                  }}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder={selectedDate.toLocaleDateString(transactionDateFormat, { day: 'numeric', month: 'long', year: 'numeric' })} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {(() => {
                      const items: JSX.Element[] = [];
                      const y = selectedDate.getFullYear();
                      const m = selectedDate.getMonth();
                      const daysInMonth = new Date(y, m + 1, 0).getDate();
                      for (let d = 1; d <= daysInMonth; d++) {
                        const localIso = formatDateLocal(new Date(y, m, d));
                        const label = new Date(y, m, d).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
                           items.push(
                          <SelectItem key={localIso} value={localIso}>{label}</SelectItem>
                        );
                      }
                      return items;
                    })()}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1))} aria-label="Next day">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Daily Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              title="Income"
              amount={dailyStats.income}
              type="income"
              icon={TrendingUp}
              subtitle="Today"
            />
            <StatCard
              title="Expense"
              amount={dailyStats.expense}
              type="expense"
              icon={TrendingDown}
              subtitle="Today"
            />
            <StatCard
              title="Net"
              amount={dailyStats.net}
              type={dailyStats.net >= 0 ? "income" : "expense"}
              subtitle="Today"
            />
          </div>

          {/* Daily Transactions */}
          <div>
            <h3 className="text-lg font-semibold mb-3">
              Transactions for {selectedDate.toLocaleDateString(transactionDateFormat)}
            </h3>
            {/* Add/Delete moved to All tab */}

            {dailyStats.transactions.length > 0 ? (
              <div className="space-y-2">
                {dailyStats.transactions.map((transaction) => (
                  <Card key={transaction.id} className="financial-card p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0" onClick={() => setExpandedTransaction(prev => prev === transaction.id ? null : transaction.id)}>
                        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${expandedTransaction === transaction.id ? 'rotate-180' : ''}`} />
                        <div className="min-w-0 w-full">
                          <p className="font-medium truncate">{transaction.description}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {transaction.category} • {transaction.source}
                          </p>
                        </div>
                      </div>
                      <MoneyDisplay
                        amount={transaction.type === 'credit' ? transaction.amount_cents : -transaction.amount_cents}
                        showSign
                        size="md"
                      />
                    </div>
                    <div className={`overflow-hidden transition-all duration-300 ${expandedTransaction === transaction.id ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                      {expandedTransaction === transaction.id && (
                        <div className="space-y-2 pt-2 border-t border-border/50 mt-2">
                          <div className="text-sm text-muted-foreground">Description: {transaction.description}</div>
                          <div className="text-sm text-muted-foreground">Date: {new Date(transaction.date).toLocaleDateString(transactionDateFormat)}</div>
                          <div className="text-sm text-muted-foreground">Category: {transaction.category}</div>
                          <div className="text-sm text-muted-foreground">Source: {transaction.source}</div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="financial-card p-8 text-center">
                <p className="text-muted-foreground">No transactions for this date</p>
              </Card>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="monthly" className="space-y-6 mt-6">
          {/* Month Selector with improved UX (also used for Daily selector spec) */}
          <Card className="financial-card p-4">
            <div className="flex items-center gap-3">
              <PieChart className="w-5 h-5 text-primary" />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => changeMonth(-1)} aria-label="Previous month">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Select
                  value={`${monthlyDate.getFullYear()}-${monthlyDate.getMonth()}`}
                  onValueChange={(val) => {
                    const [y, m] = val.split('-').map(Number);
                    setMonthlyDate(new Date(y, m, 1));
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
                <Button variant="outline" size="icon" onClick={() => changeMonth(1)} aria-label="Next month">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Category Breakdown + Monthly Income/Expense/Net */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {(() => {
              const income = monthlyTransactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount_cents, 0);
              const expense = monthlyTransactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount_cents, 0);
              const net = income - expense;
              return (
                <>
                  <StatCard title="Income" amount={income} type="income" icon={TrendingUp} subtitle={monthYearLabel} />
                  <StatCard title="Expense" amount={expense} type="expense" icon={TrendingDown} subtitle={monthYearLabel} />
                  <StatCard title="Net" amount={net} type={net >= 0 ? 'income' : 'expense'} subtitle={monthYearLabel} />
                </>
              );
            })()}
          </div>

          {/* Category Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Spending by Category</h3>
              <div className="flex items-center gap-3">
                <Select value={monthlySortBy} onValueChange={(v) => setMonthlySortBy(v as 'date' | 'amount')}>
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="amount">Amount</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={monthlySortDir} onValueChange={(v) => setMonthlySortDir(v as 'asc' | 'desc')}>
                  <SelectTrigger className="h-8 w-24">
                    <SelectValue placeholder="Order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Asc</SelectItem>
                    <SelectItem value="desc">Desc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {categoryStats.length > 0 ? (
              <div className="space-y-3">
                {categoryStats.map((stat) => (
                  <Card key={stat.category} className="financial-card p-4 cursor-pointer" onClick={() => setExpandedCategory(prev => prev === stat.category ? null : stat.category)}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${expandedCategory === stat.category ? 'rotate-180' : ''}`} />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{stat.category}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {stat.count} transaction{stat.count !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <MoneyDisplay 
                          amount={stat.total}
                          showSign
                          size="md"
                        />
                      </div>
                      
                      {(stat.income > 0 || stat.expense > 0) && (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {stat.income > 0 && (
                            <div className="text-income">
                              Income: <MoneyDisplay amount={stat.income} size="sm" />
                            </div>
                          )}
                          {stat.expense > 0 && (
                            <div className="text-expense">
                              Expense: <MoneyDisplay amount={stat.expense} size="sm" />
                            </div>
                          )}
                        </div>
                      )}

                      {expandedCategory === stat.category && (
                        <div className="space-y-2 pt-2 border-t border-border/50">
                          {[...monthlyTransactions
                            .filter(t => t.category === stat.category)
                            .sort((a, b) => {
                              const dir = monthlySortDir === 'asc' ? -1 : 1;
                              if (monthlySortBy === 'date') {
                                const da = new Date(a.date).getTime();
                                const db = new Date(b.date).getTime();
                                return da === db ? 0 : (da < db ? -1 : 1) * dir;
                              } else {
                                const aa = a.type === 'credit' ? a.amount_cents : -a.amount_cents;
                                const bb = b.type === 'credit' ? b.amount_cents : -b.amount_cents;
                                return aa === bb ? 0 : (aa < bb ? -1 : 1) * dir;
                              }
                            })].map(t => (
                            <div key={t.id} className="grid grid-cols-2 gap-2 text-sm items-start">
                              <div className="truncate pr-2">
                                <div className="font-medium truncate">{t.description}</div>
                                <div className="text-muted-foreground truncate">
                                  {new Date(t.date).toLocaleDateString('en-US')}
                                </div>
                              </div>
                              <div className="text-right">
                                <MoneyDisplay amount={t.type === 'credit' ? t.amount_cents : -t.amount_cents} showSign size="md" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="financial-card p-8 text-center">
                <p className="text-muted-foreground">No transactions for this month</p>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Daily selector UX parity: replace date input with month-style controls plus day picker */}
        {/* Header-like daily date selector */}
        <TabsContent value="daily">
          {/* Already implemented above - this placeholder keeps structure consistent */}
        </TabsContent>

        {/* All Transactions Tab */}
        <TabsContent value="all" className="space-y-6 mt-6">
          <Card className="financial-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">All Transactions</h3>
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="btn-primary transition-transform duration-200 hover:scale-[1.02] hover:shadow-[var(--shadow-float)]">
                    <Plus className="w-4 h-4 mr-1" /> Add Transaction
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Transaction</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm text-muted-foreground">Date</label>
                        <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Income/Expense</label>
                        <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as 'debit' | 'credit' })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="credit">Income</SelectItem>
                            <SelectItem value="debit">Expense</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Description</label>
                      <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm text-muted-foreground">Amount (IDR)</label>
                        <Input
                          type="number"
                          min={0}
                          value={form.amount_cents}
                          onChange={(e) => setForm({ ...form, amount_cents: Math.max(0, parseInt(e.target.value || '0', 10)) })}
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Category</label>
                        <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categoryOptions.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={async () => {
                        const trimmedDescription = (form.description || '').trim();
                        const trimmedCategory = (form.category || '').trim();
                        const isValidDate = Boolean(form.date);
                        const isValidType = form.type === 'debit' || form.type === 'credit';
                        const isValidAmount = Number.isFinite(form.amount_cents) && form.amount_cents > 0;
                        const isValidCategory = trimmedCategory.length > 0;
                        const isValidDescription = trimmedDescription.length > 0;

                        if (!isValidDate || !isValidType || !isValidAmount || !isValidCategory || !isValidDescription) {
                          toast({
                            title: 'Invalid input',
                            description: 'Please complete all fields. Amount must be greater than 0.',
                          });
                          return;
                        }

                        await createTransaction({
                          ...form,
                          description: trimmedDescription,
                          category: trimmedCategory,
                        });
                        setIsAddOpen(false);
                      }}
                      className="btn-primary"
                    >
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </Card>
          <div className="space-y-2">
            {transactions.length === 0 && (
              <Card className="financial-card p-8 text-center">
                <p className="text-muted-foreground">No transactions yet</p>
              </Card>
             )}
            {transactions.map(t => (
              <Card key={t.id} className="financial-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0" onClick={() => setExpandedTransaction(prev => prev === t.id ? null : t.id)}>
                    <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${expandedTransaction === t.id ? 'rotate-180' : ''}`} />
                    <div className="min-w-0 w-full">
                      <div className="font-medium truncate">{t.description}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {new Date(t.date).toLocaleDateString(transactionDateFormat)} • {t.category} • {t.source}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <MoneyDisplay amount={t.type === 'credit' ? t.amount_cents : -t.amount_cents} showSign size="md" />
                    <Button variant="ghost" size="icon" onClick={() => deleteTransaction(t.id)} className="ml-2 text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className={`overflow-hidden transition-all duration-300 ${expandedTransaction === t.id ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                  {expandedTransaction === t.id && (
                    <div className="space-y-2 pt-2 border-t border-border/50 mt-2">
                      <div className="text-sm text-muted-foreground">Description: {t.description}</div>
                      <div className="text-sm text-muted-foreground">Category: {t.category}</div>
                      <div className="text-sm text-muted-foreground">Source: {t.source}</div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};