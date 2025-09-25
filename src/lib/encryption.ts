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
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
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
 * Store encryption key in browser storage
 */
export const storeEncryptionKey = (encryptionKey: EncryptionKey): void => {
  const keyData = {
    salt: Array.from(encryptionKey.salt),
    version: encryptionKey.version
  };
  
  localStorage.setItem('financify_encryption_key', JSON.stringify(keyData));
};

/**
 * Load encryption key data from browser storage
 */
export const loadEncryptionKeyData = (): { salt: number[]; version: number } | null => {
  const stored = localStorage.getItem('financify_encryption_key');
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
export const hasEncryptionKey = (): boolean => {
  return loadEncryptionKeyData() !== null;
};

/**
 * Clear encryption key from storage
 */
export const clearEncryptionKey = (): void => {
  localStorage.removeItem('financify_encryption_key');
};

/**
 * Generate backup codes for key recovery
 */
export const generateBackupCodes = (): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const code = crypto.getRandomValues(new Uint8Array(4))
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
export const storeBackupCodes = (codes: string[]): void => {
  localStorage.setItem('financify_backup_codes', JSON.stringify(codes));
};

/**
 * Load backup codes
 */
export const loadBackupCodes = (): string[] | null => {
  const stored = localStorage.getItem('financify_backup_codes');
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};
