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
  storeEncryptedOriginalKey,
  restoreOriginalKeyWithBackupCode,
  exportRawKey,
  importRawKey,
  deriveKeyFromBackupCode,
  isEncryptionEnabled as isEncryptionEnabledLocal,
  setEncryptionEnabled as setEncryptionEnabledLocal,
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
  setupEncryption: (password: string) => Promise<{ success: boolean; backupCodes?: string[]; error?: string; key?: CryptoKey }>;
  unlockEncryption: (password: string) => Promise<{ success: boolean; error?: string }>;
  clearEncryption: () => void;
  
  // Add reset with backup code API
  resetWithBackupCode: (code: string) => Promise<{ success: boolean; key?: CryptoKey; backupCodes?: string[]; error?: string }>;
  
  // Auto encryption
  initializeAutoEncryption: () => Promise<{ success: boolean; backupCodes?: string[]; error?: string }>;
  
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

// Helper function to store backup code hashes and encrypted keys in Supabase
const storeBackupCodeHashes = async (codes: string[], originalKey: CryptoKey): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    // Export the original key as raw bytes
    const rawKey = await exportRawKey(originalKey);
    
    // Encrypt the original key with each backup code and store in Supabase
    const backupCodeData = await Promise.all(
      codes.map(async (code) => {
        const codeHash = await hashBackupCode(code);
        const backupKey = await deriveKeyFromBackupCode(code);
        const encryptedKey = await encryptData(Array.from(rawKey), backupKey);
        
        return {
          user_id: user.id,
          code_hash: codeHash,
          encrypted_key: encryptedKey,
          created_at: new Date().toISOString()
        };
      })
    );

    // Store in Supabase
    const { error } = await (supabase as any)
      .from('backup_codes')
      .upsert(backupCodeData, { onConflict: 'user_id,code_hash' });

    if (error) {
      throw error;
    }
  } catch (error) {
    // Don't throw - this is a fallback feature
  }
};

// Helper function to validate backup code and restore original key from Supabase
const validateBackupCodeHash = async (code: string): Promise<CryptoKey | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const codeHash = await hashBackupCode(code);
    
    const { data, error } = await (supabase as any)
      .from('backup_codes')
      .select('id, encrypted_key, used_at')
      .eq('user_id', user.id)
      .eq('code_hash', codeHash)
      .single();

    if (error || !data) return null;
    
    // Decrypt the original key using the backup code
    const backupKey = await deriveKeyFromBackupCode(code);
    const decryptedData = await decryptData(data.encrypted_key, backupKey);
    const rawKey = new Uint8Array(decryptedData);
    const originalKey = await importRawKey(rawKey);
    
    // Mark as used if not already used
    if (!data.used_at) {
      await (supabase as any)
        .from('backup_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('id', data.id);
    }
    
    return originalKey;
  } catch (error) {
    return null;
  }
};

export const useEncryption = (): UseEncryptionReturn => {
  const [isKeySetup, setIsKeySetup] = useState(false);
  const [isKeyLoading, setIsKeyLoading] = useState(true);
  const [currentKey, setCurrentKey] = useState<CryptoKey | null>(null);
  const { setEncryptionKey } = useFinancifyStore();

  // Check if encryption key is set up on mount and sync encryption state
  useEffect(() => {
    const checkKeySetup = async () => {
      
      const hasKey = hasEncryptionKey();
      const encryptionEnabled = isEncryptionEnabledLocal();
      
      
      setIsKeySetup(hasKey);
      
      // If we have a key and encryption is enabled, try to restore the cached key immediately
      if (hasKey && encryptionEnabled) {
        try {
          const cached = await loadCachedCryptoKey();
          if (cached) {
            setCurrentKey(cached);
            setEncryptionKey(cached);
          } else {
            // Key exists but cache is missing, encryption is disabled
            setEncryptionEnabledLocal(false);
          }
        } catch (error) {
          setEncryptionEnabledLocal(false);
        }
      }
      
      setIsKeyLoading(false);
    };
    checkKeySetup();
  }, [setEncryptionKey]);


  // Setup encryption with password
  const setupEncryption = useCallback(async (password: string): Promise<{ success: boolean; backupCodes?: string[]; error?: string; key?: CryptoKey }> => {
    try {
      setIsKeyLoading(true);
      
      // Generate new encryption key
      const encryptionKey = await generateEncryptionKey(password);
      
      // Store key data (salt + version)
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
        // Failed to persist verifier
      }

      // Generate and store backup codes
      const backupCodes = generateBackupCodes();
      storeBackupCodes(backupCodes);
      
      // Store the original encryption key encrypted with backup codes
      await storeEncryptedOriginalKey(encryptionKey.key, backupCodes);
      
      // Store backup code hashes and encrypted original key in Supabase for cross-device recovery
      await storeBackupCodeHashes(backupCodes, encryptionKey.key);
      
      // Set current key for immediate use
      setCurrentKey(encryptionKey.key);
      setIsKeySetup(true);
      
      try { await cacheCryptoKey(encryptionKey.key); } catch {}
      try { 
        setEncryptionKey(encryptionKey.key); 
        setEncryptionEnabledLocal(true); // Persist to localStorage
      } catch {}
      return { success: true, backupCodes, key: encryptionKey.key };
    } catch (error) {
      return { success: false, error: 'Failed to setup encryption' };
    } finally {
      setIsKeyLoading(false);
    }
  }, []);

  // Initialize automatic encryption for new users
  const initializeAutoEncryption = useCallback(async (): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> => {
    try {
      setIsKeyLoading(true);
      
      // Generate a random password for automatic encryption
      const randomPassword = generateRandomPassword();
      
      // Generate new encryption key
      const encryptionKey = await generateEncryptionKey(randomPassword);
      
      // Store key data (salt + version)
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
        // Failed to persist verifier
      }

      // Generate and store backup codes
      const backupCodes = generateBackupCodes();
      storeBackupCodes(backupCodes);
      
      // Store the original encryption key encrypted with backup codes
      await storeEncryptedOriginalKey(encryptionKey.key, backupCodes);
      
      // Store backup code hashes and encrypted original key in Supabase for cross-device recovery
      await storeBackupCodeHashes(backupCodes, encryptionKey.key);
      
      // Set current key for immediate use
      setCurrentKey(encryptionKey.key);
      setIsKeySetup(true);
      
      try { await cacheCryptoKey(encryptionKey.key); } catch {}
      try { 
        setEncryptionKey(encryptionKey.key); 
        setEncryptionEnabledLocal(true); // Persist to localStorage
      } catch {}
      return { success: true, backupCodes };
    } catch (error) {
      return { success: false, error: 'Failed to initialize encryption' };
    } finally {
      setIsKeyLoading(false);
    }
  }, []);

  // Helper function to generate random password
  const generateRandomPassword = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 32; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Unlock encryption with password
  const unlockEncryption = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsKeyLoading(true);
      
      const keyData = loadEncryptionKeyData();
      if (!keyData) {
        return { success: false, error: 'No encryption key found' };
      }
      
      // Recreate key from password and salt
      const key = await recreateEncryptionKey(password, new Uint8Array(keyData.salt));
      
      // Validate key against stored verifier
      const storedVerifier = localStorage.getItem('financify_key_verifier');
      let isValid = false;
      if (!storedVerifier) {
        // Backward-compat path: no verifier stored yet (older clients). Validate by round-trip
        // and create a verifier for future unlocks.
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
          isValid = false;
        }
      } else {
        try {
          const parsed = JSON.parse(storedVerifier);
          const decryptedVerifier = await decryptData(parsed, key);
          isValid = decryptedVerifier?.t === 'financify_key_verifier';
        } catch (e) {
          isValid = false;
        }
      }
      if (!isValid) {
        return { success: false, error: 'Invalid password' };
      }
      
      // Set current key only if validation passes
      setCurrentKey(key);
      try { await cacheCryptoKey(key); } catch {}
      try { 
        setEncryptionKey(key); 
        setEncryptionEnabledLocal(true); // Persist to localStorage
      } catch {}
      
      return { success: true };
    } catch (error) {
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
    setEncryptionEnabledLocal(false); // Clear from localStorage
  }, []);

  // Encrypt data
  const encrypt = useCallback(async (data: any): Promise<EncryptedData | null> => {
    if (!currentKey) {
      return null;
    }
    
    try {
      return await encryptData(data, currentKey);
    } catch (error) {
      return null;
    }
  }, [currentKey]);

  // Decrypt data
  const decrypt = useCallback(async (encryptedData: EncryptedData): Promise<any | null> => {
    if (!currentKey) {
      return null;
    }
    
    try {
      return await decryptData(encryptedData, currentKey);
    } catch (error) {
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
  const resetWithBackupCode = useCallback(async (code: string): Promise<{ success: boolean; key?: CryptoKey; backupCodes?: string[]; error?: string }> => {
    try {
      setIsKeyLoading(true);
      const normalized = (code || '').toString().replace(/\s+/g, '');
      
      if (!normalized) {
        return { success: false, error: 'Invalid backup code' };
      }

      // Try to restore the original encryption key using the backup code
      let restoredKey: CryptoKey | null = null;
      
      // First try local restoration
      restoredKey = await restoreOriginalKeyWithBackupCode(normalized);
      
      // If not found locally, try Supabase restoration (for cross-device recovery)
      if (!restoredKey) {
        restoredKey = await validateBackupCodeHash(normalized);
      }
      
      if (restoredKey) {
        // Valid backup code found - restore the original key
        setCurrentKey(restoredKey);
        setIsKeySetup(true);
        
        // Update the verifier with the restored key
        const verifierPlain = { t: 'financify_key_verifier', ts: Date.now(), n: Math.random() };
        const verifierEncrypted = await encryptData(verifierPlain, restoredKey);
        localStorage.setItem('financify_key_verifier', JSON.stringify(verifierEncrypted));
        
        // Generate new backup codes and store them
        const newCodes = generateBackupCodes();
        storeBackupCodes(newCodes);
        
        // Store the restored original key encrypted with new backup codes
        await storeEncryptedOriginalKey(restoredKey, newCodes);
        
        // Store new backup code hashes and encrypted key in Supabase
        await storeBackupCodeHashes(newCodes, restoredKey);
        
        // Set encryption state to enabled and key in store
        setEncryptionKey(restoredKey);
        setEncryptionEnabledLocal(true);
        
        // Cache the restored key for future page reloads
        await cacheCryptoKey(restoredKey);
        
        return { success: true, key: restoredKey, backupCodes: newCodes };
      } else {
        // Invalid backup code - create new encryption key with the entered code included
        const randomPassword = generateRandomPassword();
        const encryptionKey = await generateEncryptionKey(randomPassword);
        
        // Store key data (salt + version)
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
          // Failed to persist verifier
        }

        // Generate 7 new backup codes and include the user-entered code
        const newCodes = generateBackupCodes(7);
        newCodes.unshift(normalized); // Add the user-entered code as the first backup code
        
        storeBackupCodes(newCodes);
        
        // Store the original encryption key encrypted with backup codes
        await storeEncryptedOriginalKey(encryptionKey.key, newCodes);
        
        // Store backup code hashes and encrypted original key in Supabase for cross-device recovery
        await storeBackupCodeHashes(newCodes, encryptionKey.key);
        
        // Set current key for immediate use
        setCurrentKey(encryptionKey.key);
        setIsKeySetup(true);
        
        try { await cacheCryptoKey(encryptionKey.key); } catch {}
        try { 
          setEncryptionKey(encryptionKey.key); 
          setEncryptionEnabledLocal(true); // Persist to localStorage
        } catch {}
        
        return { success: true, key: encryptionKey.key, backupCodes: newCodes };
      }
    } catch (e) {
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
    initializeAutoEncryption,
    encrypt,
    decrypt,
    getBackupCodes,
    clearBackupCodes
  };
};
