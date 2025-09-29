import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { MoneyDisplay } from "@/components/MoneyDisplay";
import { useFinancifyStore, ImportedTransaction } from "@/store";
import { Calendar, TrendingUp, TrendingDown, PieChart, Plus, Trash2, ChevronLeft, ChevronRight, ChevronDown, Search, Filter, X } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";


export const ReportsScreen = ({ isActive }: { isActive?: boolean }) => {
  const { transactions, createTransaction, deleteTransaction } = useFinancifyStore();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthlyDate, setMonthlyDate] = useState(new Date());
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("daily");
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const tabsListRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<ImportedTransaction & { date: string }>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    type: 'debit',
    amount_cents: 0,
    category: 'Other',
  });
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);
  const [displayedTransactionsCount, setDisplayedTransactionsCount] = useState(50);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Swipe state
  const [swipedTransactionId, setSwipedTransactionId] = useState<string | null>(null);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [swipeCurrentX, setSwipeCurrentX] = useState<number | null>(null);
  
  // Filter card ref for outside click detection
  const filterCardRef = useRef<HTMLDivElement>(null);

  // Handle outside click to collapse filter card
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterCardRef.current && !filterCardRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
    };

    if (showFilters) {
      // Add a small delay to prevent immediate collapse when clicking the filter button
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [showFilters]);

  // Get filtered and paginated transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          transaction.description.toLowerCase().includes(query) ||
          transaction.category.toLowerCase().includes(query) ||
          transaction.source.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (selectedCategories.length > 0) {
        if (!selectedCategories.includes(transaction.category)) return false;
      }

      // Type filter
      if (selectedTypes.length > 0) {
        const transactionType = transaction.type === 'credit' ? 'Income' : 'Expense';
        if (!selectedTypes.includes(transactionType)) return false;
      }

      // Date range filter
      if (dateFrom) {
        if (transaction.date < dateFrom) return false;
      }
      if (dateTo) {
        if (transaction.date > dateTo) return false;
      }

      // Amount range filter
      if (amountMin) {
        const minAmount = parseFloat(amountMin);
        if (transaction.amount_cents < minAmount) return false;
      }
      if (amountMax) {
        const maxAmount = parseFloat(amountMax);
        if (transaction.amount_cents > maxAmount) return false;
      }

      return true;
    });
  }, [transactions, searchQuery, selectedCategories, selectedTypes, dateFrom, dateTo, amountMin, amountMax]);

  const displayedTransactions = useMemo(() => {
    return filteredTransactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, displayedTransactionsCount);
  }, [filteredTransactions, displayedTransactionsCount]);

  const hasMoreTransactions = filteredTransactions.length > displayedTransactionsCount;

  const loadMoreTransactions = () => {
    setDisplayedTransactionsCount(prev => Math.min(prev + 50, filteredTransactions.length));
  };

  // Filter helper functions
  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCategories([]);
    setSelectedTypes([]);
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setDisplayedTransactionsCount(50);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev => {
      // If clicking the same type, deselect it (toggle off)
      if (prev.includes(type)) {
        setSelectedCategories([]);
        return [];
      } else {
        // If clicking a different type, select only that type
        setSelectedCategories([]);
        return [type];
      }
    });
  };

  // Get categories based on selected transaction type
  const getFilteredCategories = () => {
    const expenseCategories = ['Food & Dining', 'Transport', 'Shopping', 'Bills & Utilities', 
                              'Housing', 'Health & Fitness', 'Entertainment & Leisure', 'Financial Fees', 'Other'];
    const incomeCategories = ['Salary / Wages', 'Business Income', 'Freelance / Side Hustle', 
                             'Investments', 'Gifts & Transfers'];
    
    if (selectedTypes.length === 0) {
      // If no type selected, don't show any categories
      return [];
    } else if (selectedTypes.includes('Expense')) {
      // If expense selected, show expense categories
      return expenseCategories;
    } else if (selectedTypes.includes('Income')) {
      // If income selected, show income categories
      return incomeCategories;
    }
    
    return [];
  };

  const hasActiveFilters = searchQuery || selectedCategories.length > 0 || selectedTypes.length > 0 || dateFrom || dateTo || amountMin || amountMax;

  // Swipe handlers
  const handleSwipeStart = (e: React.TouchEvent, transactionId: string) => {
    // Clear any existing swipe states
    setSwipedTransactionId(null);
    setSwipeStartX(null);
    setSwipeCurrentX(null);
    
    setSwipeStartX(e.touches[0].clientX);
    setSwipeCurrentX(e.touches[0].clientX);
    setSwipedTransactionId(transactionId);
  };

  const handleSwipeMove = (e: React.TouchEvent) => {
    if (swipeStartX !== null && swipedTransactionId) {
      setSwipeCurrentX(e.touches[0].clientX);
    }
  };

  const handleSwipeEnd = () => {
    if (swipeStartX !== null && swipeCurrentX !== null && swipedTransactionId) {
      const swipeDistance = swipeCurrentX - swipeStartX;
      if (swipeDistance < -50) {
        // Swipe left - reveal delete button
        setSwipedTransactionId(swipedTransactionId);
      } else {
        // Swipe right or insufficient distance - hide delete button
        setSwipedTransactionId(null);
      }
    }
    setSwipeStartX(null);
    setSwipeCurrentX(null);
  };

  const handleDeleteTransaction = (transactionId: string) => {
    deleteTransaction(transactionId);
    setSwipedTransactionId(null);
  };


  // Reset displayed transactions count when switching away from "all" tab
  useEffect(() => {
    if (activeTab !== "all") {
      setDisplayedTransactionsCount(50);
    }
  }, [activeTab]);

  // Reset activeTab to "daily" when screen becomes inactive
  useEffect(() => {
    if (isActive === false) {
      setActiveTab("daily");
      setDisplayedTransactionsCount(50);
    }
  }, [isActive]);

  // Animation logic for tabs
  useEffect(() => {
    const updateHighlightPosition = () => {
      if (!tabsListRef.current) return;

      const tabs = ["daily", "monthly", "all"];
      const activeIndex = tabs.indexOf(activeTab);
      const tabWidth = tabsListRef.current.offsetWidth / tabs.length;
      const translateX = activeIndex * tabWidth;

      setHighlightStyle({
        transform: `translateX(${translateX}px)`,
        width: `${tabWidth}px`,
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: 'hsl(var(--primary))',
        borderRadius: 'calc(var(--radius) - 2px)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 1,
      });
    };

    // Update position immediately
    updateHighlightPosition();

    // Update position on window resize
    const handleResize = () => updateHighlightPosition();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]);
  const categoryOptions = useMemo(() => {
    const expenseCategories = [
      'Food & Dining', 'Transport', 'Shopping', 'Bills & Utilities', 
      'Housing', 'Health & Fitness', 'Entertainment & Leisure', 'Financial Fees', 'Other'
    ];
    const incomeCategories = [
      'Salary / Wages', 'Business Income', 'Freelance / Side Hustle', 
      'Investments', 'Gifts & Transfers', 'Other'
    ];
    const defaults = [...expenseCategories, ...incomeCategories];
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
      .reduce((sum, t) => sum + Math.abs(t.amount_cents), 0);

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
        acc[t.category].expense += Math.abs(t.amount_cents);
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList 
          ref={tabsListRef}
          className="grid w-full grid-cols-3 bg-secondary relative"
        >
          {/* Animated highlight background */}
          <div style={highlightStyle} />
          
          <TabsTrigger 
            value="daily" 
            className="relative z-10 data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent"
          >
            Daily
          </TabsTrigger>
          <TabsTrigger 
            value="monthly" 
            className="relative z-10 data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent"
          >
            Monthly
          </TabsTrigger>
          <TabsTrigger 
            value="all" 
            className="relative z-10 data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent"
          >
            All
          </TabsTrigger>
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
                        amount={transaction.amount_cents}
                        showSign
                        size="md"
                        animate={false}
                        transactionType={transaction.type}
                      />
                    </div>
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedTransaction === transaction.id ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="space-y-2 pt-2 border-t border-border/50 mt-2">
                        <div className="text-sm text-muted-foreground">Description: {transaction.description}</div>
                        <div className="text-sm text-muted-foreground">Date: {new Date(transaction.date).toLocaleDateString(transactionDateFormat)}</div>
                        <div className="text-sm text-muted-foreground">Category: {transaction.category}</div>
                        <div className="text-sm text-muted-foreground">Source: {transaction.source}</div>
                      </div>
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
              const expense = monthlyTransactions.filter(t => t.type === 'debit').reduce((s, t) => s + Math.abs(t.amount_cents), 0);
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
                          animate={false}
                        />
                      </div>
                      
                      {(stat.income > 0 || stat.expense > 0) && (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {stat.income > 0 && (
                            <div className="text-income">
                              Income: <MoneyDisplay amount={stat.income} size="sm" animate={false} />
                            </div>
                          )}
                          {stat.expense > 0 && (
                            <div className="text-expense">
                              Expense: <MoneyDisplay amount={stat.expense} size="sm" animate={false} />
                            </div>
                          )}
                        </div>
                      )}

                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedCategory === stat.category ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
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
                                const aa = a.amount_cents;
                                const bb = b.amount_cents;
                                return aa === bb ? 0 : (aa < bb ? -1 : 1) * dir;
                              }
                            })].map(t => (
                            <div key={t.id} className="grid grid-cols-2 gap-2 text-sm items-start cursor-pointer" onClick={() => setExpandedTransaction(prev => prev === t.id ? null : t.id)}>
                              <div className="truncate pr-2">
                                <div className="font-medium truncate flex items-center gap-2">
                                  <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${expandedTransaction === t.id ? 'rotate-180' : ''}`} />
                                  {t.description}
                                </div>
                                <div className="text-muted-foreground truncate">
                                  {new Date(t.date).toLocaleDateString('en-US')}
                                </div>
                              </div>
                              <div className="text-right">
                                <MoneyDisplay amount={t.amount_cents} showSign size="md" animate={false} transactionType={t.type} />
                              </div>
                              {expandedTransaction === t.id && (
                                <div className="col-span-2 mt-2 pt-2 border-t border-border/50">
                                  <div className="text-xs text-muted-foreground space-y-1">
                                    <div>Description: {t.description}</div>
                                    <div>Category: {t.category}</div>
                                    <div>Source: {t.source}</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
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
          {/* Search and Filter Controls */}
          <Card ref={filterCardRef} className="financial-card p-4 sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b shadow-sm">
            <div className="space-y-4">
              {/* Search Bar and Filter Toggle */}
              <div className="flex items-center gap-3 h-10">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search transactions by description, category, or source..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>

                {/* Filter Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 flex-shrink-0 transition-all duration-200 hover:scale-105 active:scale-95 h-10"
                >
                  <Filter className={`w-4 h-4 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} />
                  Filters
                  {hasActiveFilters && (
                    <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                      {[searchQuery, selectedCategories.length, selectedTypes.length, dateFrom, dateTo, amountMin, amountMax].filter(Boolean).length}
                    </span>
                  )}
                </Button>
                
                {/* Clear All Button */}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-muted-foreground hover:text-foreground flex-shrink-0 h-10"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>

              {/* Advanced Filters */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                showFilters ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="space-y-4 pt-4 border-t border-border/50">
                  {/* Type Filter */}
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <label className="text-sm font-medium mb-2 block">Transaction Type</label>
                    <div className="flex gap-2">
                      {['Income', 'Expense'].map(type => (
                        <Button
                          key={type}
                          variant={selectedTypes.includes(type) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleType(type)}
                          className="flex-1"
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                    {selectedTypes.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Selected: {selectedTypes[0]}
                      </div>
                    )}
                  </div>

                  {/* Category Filter */}
                  <div className="animate-in slide-in-from-top-2 duration-300 delay-75">
                    <label className="text-sm font-medium mb-2 block">Categories</label>
                    {selectedTypes.length === 0 ? (
                      <div className="text-sm text-muted-foreground italic">
                        Select a transaction type to see available categories
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {getFilteredCategories().map(category => (
                          <Button
                            key={category}
                            variant={selectedCategories.includes(category) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleCategory(category)}
                            className="text-xs"
                          >
                            {category}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Date Range Filter */}
                  <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2 duration-300 delay-150">
                    <div>
                      <label className="text-sm font-medium mb-2 block">From Date</label>
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        placeholder="Start date"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">To Date</label>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        placeholder="End date"
                      />
                    </div>
                  </div>

                  {/* Amount Range Filter */}
                  <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2 duration-300 delay-200">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Min Amount</label>
                      <Input
                        type="number"
                        value={amountMin}
                        onChange={(e) => setAmountMin(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Max Amount</label>
                      <Input
                        type="number"
                        value={amountMax}
                        onChange={(e) => setAmountMax(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Add Transaction moved to Import tab */}
          <div 
            className="space-y-2 pt-4"
            onClick={() => {
              // Close any open swipe states when clicking outside
              setSwipedTransactionId(null);
              setSwipeStartX(null);
              setSwipeCurrentX(null);
            }}
          >
            {/* Show transaction count info */}
            {transactions.length > 0 && (
              <div className="text-sm text-muted-foreground mb-4">
                Showing {displayedTransactions.length} of {filteredTransactions.length} transactions
                {hasActiveFilters && (
                  <span className="text-primary ml-2">(filtered from {transactions.length} total)</span>
                )}
              </div>
            )}
            
            {displayedTransactions.length === 0 && filteredTransactions.length === 0 && hasActiveFilters ? (
              <Card className="financial-card p-8 text-center">
                <p className="text-muted-foreground">No transactions match your filters</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="mt-2"
                >
                  Clear Filters
                </Button>
              </Card>
            ) : displayedTransactions.length === 0 && transactions.length === 0 ? (
              <Card className="financial-card p-8 text-center">
                <p className="text-muted-foreground">No transactions yet</p>
              </Card>
             ) : (
               displayedTransactions.map(t => (
               <div key={t.id} className="relative overflow-hidden">
                 <Card 
                   className={`financial-card p-4 transition-transform duration-300 ${
                     swipedTransactionId === t.id ? '-translate-x-20' : 'translate-x-0'
                   }`}
                   onTouchStart={(e) => handleSwipeStart(e, t.id)}
                   onTouchMove={handleSwipeMove}
                   onTouchEnd={handleSwipeEnd}
                 >
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2 flex-1 min-w-0">
                       <div className="min-w-0 w-full">
                         <div className="font-medium truncate">{t.description}</div>
                         <div className="text-sm text-muted-foreground truncate">
                           {new Date(t.date).toLocaleDateString(transactionDateFormat)}
                         </div>
                       </div>
                     </div>
                     <div className="flex items-center">
                       <MoneyDisplay amount={t.amount_cents} showSign size="md" animate={false} transactionType={t.type} />
                     </div>
                   </div>
                   <div className="space-y-2 pt-2 border-t border-border/50 mt-2">
                     <div className="text-sm text-muted-foreground">Description: {t.description}</div>
                     <div className="text-sm text-muted-foreground">Category: {t.category}</div>
                     <div className="text-sm text-muted-foreground">Source: {t.source}</div>
                   </div>
                 </Card>
                 
                 {/* Delete Button - Revealed on Swipe */}
                 <div className={`absolute right-0 top-0 h-full w-20 flex items-center justify-center transition-transform duration-300 ${
                   swipedTransactionId === t.id ? 'translate-x-0' : 'translate-x-full'
                 }`}>
                   <Button
                     variant="destructive"
                     size="sm"
                     onClick={(e) => {
                       e.stopPropagation();
                       handleDeleteTransaction(t.id);
                     }}
                     className="h-full w-16 rounded-lg"
                   >
                     Delete
                   </Button>
                 </div>
               </div>
             )))}
            
            {/* Load More Button */}
            {hasMoreTransactions && (
              <div className="flex justify-center pt-4">
                <Button 
                  onClick={loadMoreTransactions}
                  variant="outline"
                  className="w-full max-w-xs"
                >
                  Load More Transactions ({filteredTransactions.length - displayedTransactionsCount} remaining)
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};