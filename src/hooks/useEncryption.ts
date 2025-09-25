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
      const codes = loadBackupCodes() || [];
      const normalized = code.trim();
      if (!normalized || !codes.includes(normalized)) {
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
