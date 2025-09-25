import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { Tables } from '@/integrations/supabase/types';
// Removed direct import to avoid circular dependency

export interface Transaction {
  id: string;
  date: string;
  description: string;
  type: 'debit' | 'credit';
  amount_cents: number;
  currency: string;
  category: string;
  running_balance_cents: number;
  source: string;
  created_at: string;
}

export interface ImportedTransaction {
  date: string;
  description: string;
  type: 'debit' | 'credit';
  amount_cents: number;
  category?: string;
}

interface FinancifyStore {
  // Auth state
  user: User | null;
  session: Session | null;
  profile: Tables<'profiles'> | null;
  isAuthenticated: boolean;
  
  // Transactions
  transactions: Transaction[];
  importedDraft: ImportedTransaction[];
  
  // Encryption state
  isEncryptionEnabled: boolean;
  encryptionKey: CryptoKey | null;
  
  // UI state
  isLoading: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Tables<'profiles'> | null) => void;
  setTransactions: (transactions: Transaction[]) => void;
  addTransactions: (transactions: Transaction[]) => void;
  setImportedDraft: (transactions: ImportedTransaction[]) => void;
  clearImportedDraft: () => void;
  setLoading: (loading: boolean) => void;
  
  // Encryption actions
  setEncryptionKey: (key: CryptoKey | null) => void;
  setEncryptionEnabled: (enabled: boolean) => void;
  
  // Supabase actions
  loadTransactions: () => Promise<void>;
  saveTransactions: (transactions: ImportedTransaction[]) => Promise<void>;
  createTransaction: (transaction: ImportedTransaction & { date: string }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  loadProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  
  // Computed values
  getTotalBalance: () => number;
  getMonthlyStats: () => {
    income: number;
    expense: number;
    net: number;
  };
  getRecentTransactions: (limit?: number) => Transaction[];
}

export const useFinancifyStore = create<FinancifyStore>((set, get) => ({
  // Initial state
  user: null,
  session: null,
  profile: null,
  isAuthenticated: false,
  transactions: [],
  importedDraft: [],
  isEncryptionEnabled: false,
  encryptionKey: null,
  isLoading: false,
  
  // Actions
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  
  setSession: (session) => set({ session }),
  
  setProfile: (profile) => set({ profile }),
  
  setTransactions: (transactions) => set({ transactions }),
  
  addTransactions: (newTransactions) => 
    set(state => ({ 
      transactions: [...state.transactions, ...newTransactions].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )
    })),
  
  setImportedDraft: (importedDraft) => set({ importedDraft }),
  
  clearImportedDraft: () => set({ importedDraft: [] }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  // Encryption actions
  setEncryptionKey: (encryptionKey) => set({ encryptionKey }),
  
  setEncryptionEnabled: (isEncryptionEnabled) => set({ isEncryptionEnabled }),
  
  // Supabase actions
  loadTransactions: async () => {
    const { user, isEncryptionEnabled, encryptionKey } = get();
    if (!user) return;
    
    set({ isLoading: true });
    try {
      // Use encryption if enabled
      if (isEncryptionEnabled && encryptionKey) {
        const { useEncryptedStore } = await import('./encryptedStore');
        const encryptedStore = useEncryptedStore();
        const encryptedTransactions = await encryptedStore.loadEncryptedTransactions(encryptionKey);
        set({ transactions: encryptedTransactions });
        return;
      }

      // Original unencrypted logic
      const { data, error } = await (supabase.from('transactions') as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('is_encrypted', false) // Only load unencrypted transactions
        .order('date', { ascending: false });

      if (error) throw error;
      
      const transactions: Transaction[] = ((data as any[]) || []).map(t => ({
        id: t.id,
        date: (t.date || '').split('T')[0],
        description: t.description || '',
        type: (t.type as 'debit' | 'credit') || 'debit',
        amount_cents: t.amount_cents || 0,
        currency: t.currency || 'IDR',
        category: t.category || 'Other',
        running_balance_cents: t.running_balance_cents || 0,
        source: t.source || 'Manual',
        created_at: t.created_at || new Date().toISOString(),
      }));
      
      set({ transactions });
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  saveTransactions: async (importedTransactions) => {
    const { user, transactions, isEncryptionEnabled, encryptionKey } = get();
    if (!user) throw new Error('User not authenticated');
    
    set({ isLoading: true });
    try {
      // Use encryption if enabled
      if (isEncryptionEnabled && encryptionKey) {
        const { useEncryptedStore } = await import('./encryptedStore');
        const encryptedStore = useEncryptedStore();
        
        // Add date field to each transaction for encryption
        const transactionsWithDate = importedTransactions.map(t => ({
          ...t,
          date: t.date
        }));
        
        await encryptedStore.saveEncryptedTransactions(transactionsWithDate, encryptionKey);
        // Reload transactions to get the new encrypted ones
        await get().loadTransactions();
        return;
      }

      // Original unencrypted logic
      // Calculate running balance for new transactions
      const lastBalance = transactions.length > 0 ? transactions[0].running_balance_cents : 0;
      let runningBalance = lastBalance;
      
      const transactionsToInsert = importedTransactions.map((t, index) => {
        if (t.type === 'credit') {
          runningBalance += t.amount_cents;
        } else {
          runningBalance -= t.amount_cents;
        }
        
        return {
          user_id: user.id,
          date: t.date,
          description: t.description,
          type: t.type,
          amount_cents: t.amount_cents,
          currency: 'IDR',
          category: t.category || 'Other',
          running_balance_cents: runningBalance,
          source: 'PDF Import',
          is_encrypted: false, // Explicitly mark as unencrypted
        };
      });

      const { data, error } = await supabase
        .from('transactions')
        .insert(transactionsToInsert)
        .select();

      if (error) throw error;
      
      // Add new transactions to state
      const newTransactions: Transaction[] = (data || []).map(t => ({
        id: t.id,
        date: t.date,
        description: t.description || '',
        type: (t.type as 'debit' | 'credit') || 'debit',
        amount_cents: t.amount_cents || 0,
        currency: t.currency || 'IDR',
        category: t.category || 'Other',
        running_balance_cents: t.running_balance_cents || 0,
        source: t.source || 'Manual',
        created_at: t.created_at || new Date().toISOString(),
      }));
      
      get().addTransactions(newTransactions);
    } catch (error) {
      console.error('Error saving transactions:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  createTransaction: async (transaction) => {
    const { user, transactions, isEncryptionEnabled, encryptionKey } = get();
    if (!user) throw new Error('User not authenticated');

    set({ isLoading: true });
    try {
      // Use encryption if enabled
      if (isEncryptionEnabled && encryptionKey) {
        const { useEncryptedStore } = await import('./encryptedStore');
        const encryptedStore = useEncryptedStore();
        await encryptedStore.createEncryptedTransaction(transaction, encryptionKey);
        // Reload transactions to get the new encrypted one
        await get().loadTransactions();
        return;
      }

      // Original unencrypted logic
      const lastBalance = transactions.length > 0 ? transactions[0].running_balance_cents : 0;
      const runningBalance = transaction.type === 'credit'
        ? lastBalance + transaction.amount_cents
        : lastBalance - transaction.amount_cents;

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          date: transaction.date,
          description: transaction.description,
          type: transaction.type,
          amount_cents: transaction.amount_cents,
          currency: 'IDR',
          category: transaction.category || 'Other',
          running_balance_cents: runningBalance,
          source: 'Manual',
          is_encrypted: false, // Explicitly mark as unencrypted
        })
        .select()
        .single();

      if (error) throw error;

      const newTransaction: Transaction = {
        id: data.id,
        date: data.date,
        description: data.description || '',
        type: (data.type as 'debit' | 'credit') || 'debit',
        amount_cents: data.amount_cents || 0,
        currency: data.currency || 'IDR',
        category: data.category || 'Other',
        running_balance_cents: data.running_balance_cents || 0,
        source: data.source || 'Manual',
        created_at: data.created_at || new Date().toISOString(),
      };

      get().addTransactions([newTransaction]);
      // Ensure consistency with server state
      await get().loadTransactions();
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteTransaction: async (id) => {
    const { user } = get();
    if (!user) throw new Error('User not authenticated');

    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .select();
      if (error) throw error;

      set(state => ({
        transactions: state.transactions.filter(t => t.id !== id)
      }));
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  loadProfile: async () => {
    const { user } = get();
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      set({ profile: data });
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      user: null,
      session: null,
      profile: null,
      isAuthenticated: false,
      transactions: [],
      importedDraft: [],
    });
  },
  
  // Computed values
  getTotalBalance: () => {
    const { transactions } = get();
    if (transactions.length === 0) return 0;

    // Compute balance as sum(credits) - sum(debits)
    const balance = transactions.reduce((acc, t) => {
      return acc + (t.type === 'credit' ? t.amount_cents : -t.amount_cents);
    }, 0);

    return balance;
  },
  
  getMonthlyStats: () => {
    const { transactions } = get();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getMonth() === currentMonth && 
             transactionDate.getFullYear() === currentYear;
    });
    
    const income = monthlyTransactions
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount_cents, 0);
      
    const expense = monthlyTransactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount_cents, 0);
    
    return {
      income,
      expense,
      net: income - expense
    };
  },
  
  getRecentTransactions: (limit = 5) => {
    const { transactions } = get();
    return transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }
}));