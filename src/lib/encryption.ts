/**
 * End-to-End Encryption Utilities for Financify
 * Phase 1: Transaction Encryption
 */

export interface EncryptedData {
  data: number[];
  iv: number[];
  version: number;
}

export interface EncryptionKey {
  key: CryptoKey;
  salt: Uint8Array;
  version: number;
}

/**
 * Generate a random salt for key derivation
 */
export const generateSalt = (): Uint8Array => {
  return crypto.getRandomValues(new Uint8Array(16));
};

/**
 * Derive encryption key from password using PBKDF2
 */
export const deriveKeyFromPassword = async (
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

/**
 * Generate a new encryption key from password
 */
export const generateEncryptionKey = async (
  password: string
): Promise<EncryptionKey> => {
  const salt = generateSalt();
  const key = await deriveKeyFromPassword(password, salt);
  
  return {
    key,
    salt,
    version: 1
  };
};

/**
 * Recreate encryption key from password and salt
 */
export const recreateEncryptionKey = async (
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> => {
  return deriveKeyFromPassword(password, salt);
};

/**
 * Encrypt data using AES-GCM
 */
export const encryptData = async (
  data: any,
  key: CryptoKey
): Promise<EncryptedData> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoded
  );

  return {
    data: Array.from(new Uint8Array(encrypted)),
    iv: Array.from(iv),
    version: 1
  };
};

/**
 * Decrypt data using AES-GCM
 */
export const decryptData = async (
  encryptedData: EncryptedData,
  key: CryptoKey
): Promise<any> => {
  const iv = new Uint8Array(encryptedData.iv);
  const data = new Uint8Array(encryptedData.data);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    data
  );

  const decoded = new TextDecoder().decode(decrypted);
  return JSON.parse(decoded);
};

/**
 * Low-level helpers for caching keys locally (device-only convenience):
 * We export/import the raw AES-GCM key and wrap it with a device-local wrapping key.
 */

export const exportRawKey = async (key: CryptoKey): Promise<Uint8Array> => {
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw as ArrayBuffer);
};

export const importRawKey = async (raw: Uint8Array): Promise<CryptoKey> => {
  return crypto.subtle.importKey('raw', raw.buffer as ArrayBuffer, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
};

// Create or load a device wrapping key (stored as raw bytes in localStorage)
const getDeviceWrappingKey = async (userId?: string): Promise<CryptoKey> => {
  const keyName = userId ? `financify_device_wrap_key_${userId}` : 'financify_device_wrap_key';
  let rawStr = localStorage.getItem(keyName);
  let raw: Uint8Array;
  if (!rawStr) {
    raw = crypto.getRandomValues(new Uint8Array(32));
    localStorage.setItem(keyName, JSON.stringify(Array.from(raw)));
  } else {
    raw = new Uint8Array(JSON.parse(rawStr));
  }
  return crypto.subtle.importKey('raw', raw.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
};

export const cacheCryptoKey = async (key: CryptoKey, userId?: string): Promise<void> => {
  const wrappingKey = await getDeviceWrappingKey(userId);
  const raw = await exportRawKey(key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, raw.buffer as ArrayBuffer);
  const keyName = userId ? `financify_cached_key_${userId}` : 'financify_cached_key';
  localStorage.setItem(keyName, JSON.stringify({
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  }));
};

export const loadCachedCryptoKey = async (userId?: string): Promise<CryptoKey | null> => {
  const keyName = userId ? `financify_cached_key_${userId}` : 'financify_cached_key';
  const stored = localStorage.getItem(keyName);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    const wrappingKey = await getDeviceWrappingKey(userId);
    const iv = new Uint8Array(parsed.iv);
    const data = new Uint8Array(parsed.data);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, data);
    const raw = new Uint8Array(decrypted);
    return importRawKey(raw);
  } catch {
    return null;
  }
};

/**
 * Store encryption key in browser storage
 */
export const storeEncryptionKey = (encryptionKey: EncryptionKey, userId?: string): void => {
  const keyData = {
    salt: Array.from(encryptionKey.salt),
    version: encryptionKey.version
  };
  
  const keyName = userId ? `financify_encryption_key_${userId}` : 'financify_encryption_key';
  const enabledName = userId ? `financify_encryption_enabled_${userId}` : 'financify_encryption_enabled';
  
  localStorage.setItem(keyName, JSON.stringify(keyData));
  // Also store that encryption is enabled
  localStorage.setItem(enabledName, 'true');
};

/**
 * Load encryption key data from browser storage
 */
export const loadEncryptionKeyData = (userId?: string): { salt: number[]; version: number } | null => {
  const keyName = userId ? `financify_encryption_key_${userId}` : 'financify_encryption_key';
  const stored = localStorage.getItem(keyName);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

/**
 * Check if user has encryption key set up
 */
export const hasEncryptionKey = (userId?: string): boolean => {
  return loadEncryptionKeyData(userId) !== null;
};

/**
 * Clear encryption key from storage
 */
export const clearEncryptionKey = (userId?: string): void => {
  const keyName = userId ? `financify_encryption_key_${userId}` : 'financify_encryption_key';
  const enabledName = userId ? `financify_encryption_enabled_${userId}` : 'financify_encryption_enabled';
  const cachedName = userId ? `financify_cached_key_${userId}` : 'financify_cached_key';
  const verifierName = userId ? `financify_key_verifier_${userId}` : 'financify_key_verifier';
  const backupName = userId ? `financify_backup_codes_${userId}` : 'financify_backup_codes';
  const encryptedKeyName = userId ? `financify_encrypted_original_key_${userId}` : 'financify_encrypted_original_key';
  
  localStorage.removeItem(keyName);
  localStorage.removeItem(enabledName);
  localStorage.removeItem(cachedName);
  localStorage.removeItem(verifierName);
  localStorage.removeItem(backupName);
  localStorage.removeItem(encryptedKeyName);
};

/**
 * Check if encryption is enabled (persisted state)
 */
export const isEncryptionEnabled = (userId?: string): boolean => {
  const enabledName = userId ? `financify_encryption_enabled_${userId}` : 'financify_encryption_enabled';
  return localStorage.getItem(enabledName) === 'true';
};

/**
 * Set encryption enabled state
 */
export const setEncryptionEnabled = (enabled: boolean, userId?: string): void => {
  const enabledName = userId ? `financify_encryption_enabled_${userId}` : 'financify_encryption_enabled';
  if (enabled) {
    localStorage.setItem(enabledName, 'true');
  } else {
    localStorage.removeItem(enabledName);
  }
};

/**
 * Generate backup codes for key recovery
 */
export const generateBackupCodes = (): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(4));
    const code = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    codes.push(code);
  }
  return codes;
};

/**
 * Store backup codes
 */
export const storeBackupCodes = (codes: string[], userId?: string): void => {
  const backupName = userId ? `financify_backup_codes_${userId}` : 'financify_backup_codes';
  localStorage.setItem(backupName, JSON.stringify(codes));
};

/**
 * Load backup codes
 */
export const loadBackupCodes = (userId?: string): string[] | null => {
  const backupName = userId ? `financify_backup_codes_${userId}` : 'financify_backup_codes';
  const stored = localStorage.getItem(backupName);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

/**
 * Derive key from backup code for encrypting/decrypting the original encryption key
 */
export const deriveKeyFromBackupCode = async (backupCode: string): Promise<CryptoKey> => {
  // Use a fixed salt for backup code derivation to ensure consistency
  const salt = new TextEncoder().encode('financify_backup_code_salt');
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(backupCode),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

/**
 * Store the original encryption key encrypted with backup codes
 */
export const storeEncryptedOriginalKey = async (originalKey: CryptoKey, backupCodes: string[], userId?: string): Promise<void> => {
  try {
    // Export the original key as raw bytes
    const rawKey = await exportRawKey(originalKey);
    
    // Encrypt the original key with each backup code
    const encryptedKeys = await Promise.all(
      backupCodes.map(async (code) => {
        const backupKey = await deriveKeyFromBackupCode(code);
        const encrypted = await encryptData(Array.from(rawKey), backupKey);
        return { code, encrypted };
      })
    );
    
    // Store in localStorage
    const encryptedKeyName = userId ? `financify_encrypted_original_key_${userId}` : 'financify_encrypted_original_key';
    localStorage.setItem(encryptedKeyName, JSON.stringify(encryptedKeys));
  } catch (error) {
    console.error('Failed to store encrypted original key:', error);
  }
};

/**
 * Restore the original encryption key using a backup code
 */
export const restoreOriginalKeyWithBackupCode = async (backupCode: string, userId?: string): Promise<CryptoKey | null> => {
  try {
    const encryptedKeyName = userId ? `financify_encrypted_original_key_${userId}` : 'financify_encrypted_original_key';
    const stored = localStorage.getItem(encryptedKeyName);
    if (!stored) return null;
    
    const encryptedKeys = JSON.parse(stored);
    const backupKey = await deriveKeyFromBackupCode(backupCode);
    
    // Find the encrypted key for this backup code
    const keyData = encryptedKeys.find((item: any) => item.code === backupCode);
    if (!keyData) return null;
    
    // Decrypt the original key
    const decryptedData = await decryptData(keyData.encrypted, backupKey);
    const rawKey = new Uint8Array(decryptedData);
    
    return importRawKey(rawKey);
  } catch (error) {
    console.error('Failed to restore original key:', error);
    return null;
  }
};

/**
 * Migration functions for backward compatibility
 */

/**
 * Migrate global encryption keys to user-specific keys
 */
export const migrateToUserSpecificKeys = (userId: string): void => {
  if (!userId) return;
  
  // List of keys to migrate
  const keysToMigrate = [
    'financify_encryption_key',
    'financify_encryption_enabled',
    'financify_cached_key',
    'financify_key_verifier',
    'financify_backup_codes',
    'financify_encrypted_original_key',
    'financify_device_wrap_key'
  ];
  
  keysToMigrate.forEach(keyName => {
    const globalValue = localStorage.getItem(keyName);
    if (globalValue) {
      const userSpecificKey = `${keyName}_${userId}`;
      localStorage.setItem(userSpecificKey, globalValue);
      // Keep global key for now to avoid breaking existing sessions
      // localStorage.removeItem(keyName); // Uncomment after migration is complete
    }
  });
};

/**
 * Check if user has migrated keys
 */
export const hasUserMigratedKeys = (userId: string): boolean => {
  if (!userId) return false;
  return localStorage.getItem(`financify_encryption_key_${userId}`) !== null;
};

/**
 * Get user-specific key name with fallback to global
 */
export const getUserSpecificKeyName = (baseKey: string, userId?: string): string => {
  if (userId) {
    return `${baseKey}_${userId}`;
  }
  return baseKey;
};

/**
 * Clear all user-specific encryption data (for user switching)
 */
export const clearUserEncryptionData = (userId: string): void => {
  if (!userId) return;
  
  const keysToRemove = [
    `financify_encryption_key_${userId}`,
    `financify_encryption_enabled_${userId}`,
    `financify_cached_key_${userId}`,
    `financify_key_verifier_${userId}`,
    `financify_backup_codes_${userId}`,
    `financify_encrypted_original_key_${userId}`,
    `financify_device_wrap_key_${userId}`
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
};
