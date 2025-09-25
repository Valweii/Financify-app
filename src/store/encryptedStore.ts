/**
 * Encrypted Store Extension
 * Handles encryption/decryption of transaction data
 */

import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Transaction, ImportedTransaction } from './index';
import type { EncryptedData } from '@/lib/encryption';

export interface EncryptedTransaction {
  id: string;
  user_id: string;
  encrypted_data: string;
  encryption_iv: string;
  encryption_version: number;
  is_encrypted: boolean;
  created_at: string;
}

export interface EncryptedStore {
  // Encryption operations
  encryptTransaction: (transaction: ImportedTransaction, encryptionKey: CryptoKey) => Promise<EncryptedData | null>;
  decryptTransaction: (encryptedData: EncryptedData, encryptionKey: CryptoKey) => Promise<ImportedTransaction | null>;
  
  // Encrypted database operations
  createEncryptedTransaction: (transaction: ImportedTransaction & { date: string }, encryptionKey: CryptoKey) => Promise<void>;
  loadEncryptedTransactions: (encryptionKey: CryptoKey) => Promise<Transaction[]>;
  saveEncryptedTransactions: (transactions: (ImportedTransaction & { date: string })[], encryptionKey: CryptoKey) => Promise<void>;
  deleteEncryptedTransaction: (id: string) => Promise<void>;
}

export const useEncryptedStore = (): EncryptedStore => {
  // Encrypt transaction data
  const encryptTransaction = async (
    transaction: ImportedTransaction,
    encryptionKey: CryptoKey
  ): Promise<EncryptedData | null> => {
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(JSON.stringify(transaction));

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        encryptionKey,
        encoded
      );

      return {
        data: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv),
        version: 1
      };
    } catch (error) {
      console.error('Failed to encrypt transaction:', error);
      return null;
    }
  };

  // Decrypt transaction data
  const decryptTransaction = async (
    encryptedData: EncryptedData,
    encryptionKey: CryptoKey
  ): Promise<ImportedTransaction | null> => {
    try {
      const iv = new Uint8Array(encryptedData.iv);
      const data = new Uint8Array(encryptedData.data);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        encryptionKey,
        data
      );

      const decoded = new TextDecoder().decode(decrypted);
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Failed to decrypt transaction:', error);
      return null;
    }
  };

  // Create encrypted transaction
  const createEncryptedTransaction = async (
    transaction: ImportedTransaction & { date: string },
    encryptionKey: CryptoKey
  ): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const encrypted = await encryptTransaction(transaction, encryptionKey);
    if (!encrypted) throw new Error('Failed to encrypt transaction');

    const { error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        encrypted_data: JSON.stringify(encrypted.data),
        encryption_iv: JSON.stringify(encrypted.iv),
        encryption_version: encrypted.version,
        is_encrypted: true,
        // Keep date unencrypted for sorting/filtering
        date: transaction.date
      });

    if (error) throw error;
  };

  // Load and decrypt transactions
  const loadEncryptedTransactions = async (
    encryptionKey: CryptoKey
  ): Promise<Transaction[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    console.log('🔍 Loading encrypted transactions for user:', user.id);

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_encrypted', true)
      .order('date', { ascending: false });

    if (error) {
      console.error('❌ Error loading encrypted transactions:', error);
      throw error;
    }

    console.log('📊 Raw encrypted transactions from DB:', data?.length || 0, data);

    const decryptedTransactions: Transaction[] = [];

    for (const encryptedTx of data || []) {
      try {
        const encryptedData: EncryptedData = {
          data: JSON.parse(encryptedTx.encrypted_data),
          iv: JSON.parse(encryptedTx.encryption_iv),
          version: encryptedTx.encryption_version
        };

        const decrypted = await decryptTransaction(encryptedData, encryptionKey);
        if (decrypted) {
          // Calculate running balance
          const lastBalance = decryptedTransactions.length > 0 
            ? decryptedTransactions[0].running_balance_cents 
            : 0;
          
          const runningBalance = decrypted.type === 'credit'
            ? lastBalance + decrypted.amount_cents
            : lastBalance - decrypted.amount_cents;

          decryptedTransactions.push({
            id: encryptedTx.id,
            date: ((encryptedTx.date || decrypted.date) || '').split('T')[0], // normalize to YYYY-MM-DD
            description: decrypted.description,
            type: decrypted.type,
            amount_cents: decrypted.amount_cents,
            currency: 'IDR',
            category: decrypted.category || 'Other',
            running_balance_cents: runningBalance,
            source: 'Encrypted',
            created_at: encryptedTx.created_at
          });
        }
      } catch (error) {
        console.error('Failed to decrypt transaction:', encryptedTx.id, error);
        // Skip this transaction if decryption fails
      }
    }

    return decryptedTransactions;
  };

  // Save multiple encrypted transactions
  const saveEncryptedTransactions = async (
    transactions: (ImportedTransaction & { date: string })[],
    encryptionKey: CryptoKey
  ): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const encryptedTransactions = [];

    for (const transaction of transactions) {
      const encrypted = await encryptTransaction(transaction, encryptionKey);
      if (encrypted) {
        encryptedTransactions.push({
          user_id: user.id,
          encrypted_data: JSON.stringify(encrypted.data),
          encryption_iv: JSON.stringify(encrypted.iv),
          encryption_version: encrypted.version,
          is_encrypted: true,
          date: transaction.date
        });
      }
    }

    if (encryptedTransactions.length > 0) {
      const { error } = await supabase
        .from('transactions')
        .insert(encryptedTransactions);

      if (error) throw error;
    }
  };

  // Delete encrypted transaction
  const deleteEncryptedTransaction = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('is_encrypted', true);

    if (error) throw error;
  };

  return {
    encryptTransaction,
    decryptTransaction,
    createEncryptedTransaction,
    loadEncryptedTransactions,
    saveEncryptedTransactions,
    deleteEncryptedTransaction
  };
};
