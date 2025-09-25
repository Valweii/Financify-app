/**
 * Encryption Key Management Hook
 * Handles encryption key lifecycle and operations
 */

import { useState, useEffect, useCallback } from 'react';
import {
  generateEncryptionKey,
  recreateEncryptionKey,
  loadEncryptionKeyData,
  hasEncryptionKey,
  clearEncryptionKey,
  generateBackupCodes,
  storeBackupCodes,
  loadBackupCodes,
  encryptData,
  decryptData,
  storeEncryptionKey,
  cacheCryptoKey,
  loadCachedCryptoKey,
  type EncryptionKey,
  type EncryptedData
} from '@/lib/encryption';
import { useFinancifyStore } from '@/store';
import { supabase } from '@/integrations/supabase/client';

export interface UseEncryptionReturn {
  // Key management
  isKeySetup: boolean;
  isKeyLoading: boolean;
  currentKey: CryptoKey | null;
  setupEncryption: (password: string) => Promise<{ success: boolean; backupCodes?: string[]; error?: string }>;
  unlockEncryption: (password: string) => Promise<{ success: boolean; error?: string }>;
  clearEncryption: () => void;
  
  // Add reset with backup code API
  resetWithBackupCode: (code: string, newPassword: string) => Promise<{ success: boolean; backupCodes?: string[]; error?: string }>;
  
  // Encryption operations
  encrypt: (data: any) => Promise<EncryptedData | null>;
  decrypt: (encryptedData: EncryptedData) => Promise<any | null>;
  
  // Backup codes
  getBackupCodes: () => string[] | null;
  clearBackupCodes: () => void;
}

// Helper function to hash backup codes for storage
const hashBackupCode = async (code: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Helper function to store backup code hashes in Supabase
const storeBackupCodeHashes = async (codes: string[]): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    // Hash all backup codes
    const hashedCodes = await Promise.all(codes.map(code => hashBackupCode(code)));

    // Store hashes in Supabase
    const { error } = await (supabase as any)
      .from('backup_codes')
      .upsert(
        hashedCodes.map(hash => ({
          user_id: user.id,
          code_hash: hash,
          created_at: new Date().toISOString()
        })),
        { onConflict: 'user_id,code_hash' }
      );

    if (error) {
      console.error('Failed to store backup code hashes:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error storing backup code hashes:', error);
    // Don't throw - this is a fallback feature
  }
};

// Helper function to validate backup code against Supabase hashes
const validateBackupCodeHash = async (code: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const codeHash = await hashBackupCode(code);
    
    const { data, error } = await (supabase as any)
      .from('backup_codes')
      .select('id, used_at')
      .eq('user_id', user.id)
      .eq('code_hash', codeHash)
      .single();

    if (error || !data) return false;
    
    // Mark as used if not already used
    if (!data.used_at) {
      await (supabase as any)
        .from('backup_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('id', data.id);
    }
    
    return true;
  } catch (error) {
    console.error('Error validating backup code hash:', error);
    return false;
  }
};

export const useEncryption = (): UseEncryptionReturn => {
  const [isKeySetup, setIsKeySetup] = useState(false);
  const [isKeyLoading, setIsKeyLoading] = useState(true);
  const [currentKey, setCurrentKey] = useState<CryptoKey | null>(null);
  const { setEncryptionKey, setEncryptionEnabled } = useFinancifyStore();

  // Check if encryption key is set up on mount
  useEffect(() => {
    const checkKeySetup = () => {
      const hasKey = hasEncryptionKey();
      setIsKeySetup(hasKey);
      setIsKeyLoading(false);
    };
    checkKeySetup();
  }, []);

  // Try to restore cached CryptoKey silently on mount (WhatsApp-like UX)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (currentKey) return;
      // Ensure the UI waits for auto-restore before showing the gate
      setIsKeyLoading(true);
      const cached = await loadCachedCryptoKey();
      if (!cancelled && cached) {
        setCurrentKey(cached);
        try { setEncryptionKey(cached); setEncryptionEnabled(true); } catch {}
      }
      if (!cancelled) setIsKeyLoading(false);
    })();
    return () => { cancelled = true; };
  }, [currentKey, setEncryptionEnabled, setEncryptionKey]);

  // Setup encryption with password
  const setupEncryption = useCallback(async (password: string): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> => {
    try {
      console.log('🔍 setupEncryption called');
      setIsKeyLoading(true);
      
      // Generate new encryption key
      console.log('🔐 Generating new encryption key...');
      const encryptionKey = await generateEncryptionKey(password);
      
      // Store key data (salt + version)
      console.log('🔐 Storing encryption key data...');
      storeEncryptionKey(encryptionKey);
      
      // Create and store a verifier encrypted with the derived key for future password validation
      try {
        const verifierPlain = {
          t: 'financify_key_verifier',
          ts: Date.now(),
          n: Math.random(),
        };
        const verifierEncrypted = await encryptData(verifierPlain, encryptionKey.key);
        localStorage.setItem('financify_key_verifier', JSON.stringify(verifierEncrypted));
      } catch (e) {
        console.warn('Failed to persist verifier:', e);
      }

      // Generate and store backup codes
      console.log('🔐 Generating backup codes...');
      const backupCodes = generateBackupCodes();
      storeBackupCodes(backupCodes);
      
      // Store backup code hashes in Supabase for cross-device recovery
      console.log('🔐 Storing backup code hashes in Supabase...');
      await storeBackupCodeHashes(backupCodes);
      
      // Set current key for immediate use
      console.log('🔐 Setting current key...');
      setCurrentKey(encryptionKey.key);
      setIsKeySetup(true);
      
      console.log('✅ Encryption setup completed successfully');
      try { await cacheCryptoKey(encryptionKey.key); } catch {}
      try { setEncryptionKey(encryptionKey.key); setEncryptionEnabled(true); } catch {}
      return { success: true, backupCodes };
    } catch (error) {
      console.error('❌ Failed to setup encryption:', error);
      return { success: false, error: 'Failed to setup encryption' };
    } finally {
      setIsKeyLoading(false);
    }
  }, []);

  // Unlock encryption with password
  const unlockEncryption = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('🔍 unlockEncryption called');
      setIsKeyLoading(true);
      
      const keyData = loadEncryptionKeyData();
      console.log('🔍 keyData loaded:', !!keyData);
      if (!keyData) {
        console.log('❌ No encryption key found');
        return { success: false, error: 'No encryption key found' };
      }
      
      // Recreate key from password and salt
      console.log('🔐 Recreating key from password and salt...');
      const key = await recreateEncryptionKey(password, new Uint8Array(keyData.salt));
      
      // Validate key against stored verifier
      const storedVerifier = localStorage.getItem('financify_key_verifier');
      let isValid = false;
      if (!storedVerifier) {
        // Backward-compat path: no verifier stored yet (older clients). Validate by round-trip
        // and create a verifier for future unlocks.
        console.log('⚠️ Missing key verifier – performing compatibility validation');
        try {
          const probe = { t: 'probe', ts: Date.now() } as const;
          const enc = await encryptData(probe, key);
          const dec = await decryptData(enc, key);
          isValid = dec?.t === 'probe';
          if (isValid) {
            const verifierPlain = { t: 'financify_key_verifier', ts: Date.now(), n: Math.random() };
            const verifierEncrypted = await encryptData(verifierPlain, key);
            localStorage.setItem('financify_key_verifier', JSON.stringify(verifierEncrypted));
          }
        } catch (e) {
          console.log('❌ Compatibility validation failed');
          isValid = false;
        }
      } else {
        try {
          const parsed = JSON.parse(storedVerifier);
          const decryptedVerifier = await decryptData(parsed, key);
          isValid = decryptedVerifier?.t === 'financify_key_verifier';
        } catch (e) {
          console.log('❌ Verifier decryption failed');
          isValid = false;
        }
      }
      if (!isValid) {
        return { success: false, error: 'Invalid password' };
      }
      
      // Set current key only if validation passes
      console.log('✅ Key validation successful');
      setCurrentKey(key);
      try { await cacheCryptoKey(key); } catch {}
      try { setEncryptionKey(key); setEncryptionEnabled(true); } catch {}
      
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to unlock encryption:', error);
      return { success: false, error: 'Invalid password' };
    } finally {
      setIsKeyLoading(false);
    }
  }, []);

  // Clear encryption
  const clearEncryption = useCallback(() => {
    clearEncryptionKey();
    setCurrentKey(null);
    setIsKeySetup(false);
  }, []);

  // Encrypt data
  const encrypt = useCallback(async (data: any): Promise<EncryptedData | null> => {
    if (!currentKey) {
      console.error('No encryption key available');
      return null;
    }
    
    try {
      return await encryptData(data, currentKey);
    } catch (error) {
      console.error('Failed to encrypt data:', error);
      return null;
    }
  }, [currentKey]);

  // Decrypt data
  const decrypt = useCallback(async (encryptedData: EncryptedData): Promise<any | null> => {
    if (!currentKey) {
      console.error('No encryption key available');
      return null;
    }
    
    try {
      return await decryptData(encryptedData, currentKey);
    } catch (error) {
      console.error('Failed to decrypt data:', error);
      return null;
    }
  }, [currentKey]);

  // Get backup codes
  const getBackupCodes = useCallback((): string[] | null => {
    return loadBackupCodes();
  }, []);

  // Clear backup codes
  const clearBackupCodes = useCallback(() => {
    localStorage.removeItem('financify_backup_codes');
  }, []);

  // Reset encryption using a backup code
  const resetWithBackupCode = useCallback(async (code: string, newPassword: string): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> => {
    try {
      setIsKeyLoading(true);
      const normalized = (code || '').toString().replace(/\s+/g, '');
      
      if (!normalized) {
        return { success: false, error: 'Invalid backup code' };
      }

      // First try local validation (for same-device recovery)
      const localCodes = (loadBackupCodes() || []).map(c => (c || '').toString().replace(/\s+/g, ''));
      let isValidCode = localCodes.includes(normalized);
      
      // If not found locally, try Supabase validation (for cross-device recovery)
      if (!isValidCode) {
        console.log('🔍 Code not found locally, checking Supabase...');
        isValidCode = await validateBackupCodeHash(normalized);
      }
      
      if (!isValidCode) {
        return { success: false, error: 'Invalid backup code' };
      }

      // Create new key and overwrite verifier and backup codes
      const newEncKey = await generateEncryptionKey(newPassword);
      storeEncryptionKey(newEncKey);

      const verifierPlain = { t: 'financify_key_verifier', ts: Date.now(), n: Math.random() };
      const verifierEncrypted = await encryptData(verifierPlain, newEncKey.key);
      localStorage.setItem('financify_key_verifier', JSON.stringify(verifierEncrypted));

      const newCodes = generateBackupCodes();
      storeBackupCodes(newCodes);
      
      // Store new backup code hashes in Supabase
      await storeBackupCodeHashes(newCodes);

      setCurrentKey(newEncKey.key);
      setIsKeySetup(true);
      return { success: true, backupCodes: newCodes };
    } catch (e) {
      console.error('Failed to reset with backup code:', e);
      return { success: false, error: 'Failed to reset encryption' };
    } finally {
      setIsKeyLoading(false);
    }
  }, []);

  return {
    isKeySetup,
    isKeyLoading,
    currentKey,
    setupEncryption,
    unlockEncryption,
    clearEncryption,
    resetWithBackupCode,
    encrypt,
    decrypt,
    getBackupCodes,
    clearBackupCodes
  };
};
