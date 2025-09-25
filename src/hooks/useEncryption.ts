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
  type EncryptionKey,
  type EncryptedData
} from '@/lib/encryption';

export interface UseEncryptionReturn {
  // Key management
  isKeySetup: boolean;
  isKeyLoading: boolean;
  currentKey: CryptoKey | null;
  setupEncryption: (password: string) => Promise<{ success: boolean; backupCodes?: string[]; error?: string }>;
  unlockEncryption: (password: string) => Promise<{ success: boolean; error?: string }>;
  clearEncryption: () => void;
  
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

  // Check if encryption key is set up on mount
  useEffect(() => {
    const checkKeySetup = () => {
      setIsKeySetup(hasEncryptionKey());
      setIsKeyLoading(false);
    };
    
    checkKeySetup();
  }, []);

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
      
      // Generate and store backup codes
      console.log('🔐 Generating backup codes...');
      const backupCodes = generateBackupCodes();
      storeBackupCodes(backupCodes);
      
      // Set current key for immediate use
      console.log('🔐 Setting current key...');
      setCurrentKey(encryptionKey.key);
      setIsKeySetup(true);
      
      console.log('✅ Encryption setup completed successfully');
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
      
      // Test the key by trying to encrypt/decrypt a test value
      console.log('🔐 Testing key with encryption/decryption...');
      const testData = { test: 'validation', timestamp: Date.now() };
      const encrypted = await encryptData(testData, key);
      const decrypted = await decryptData(encrypted, key);
      
      if (JSON.stringify(testData) !== JSON.stringify(decrypted)) {
        console.log('❌ Key validation failed - password incorrect');
        return { success: false, error: 'Invalid password' };
      }
      
      // Set current key only if validation passes
      console.log('✅ Key validation successful');
      setCurrentKey(key);
      
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

  return {
    isKeySetup,
    isKeyLoading,
    currentKey,
    setupEncryption,
    unlockEncryption,
    clearEncryption,
    encrypt,
    decrypt,
    getBackupCodes,
    clearBackupCodes
  };
};
