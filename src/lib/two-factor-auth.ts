import { TOTP } from 'jsotp';
import QRCode from 'qrcode';

export interface TwoFactorAuthSecret {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
}

export interface TwoFactorAuthConfig {
  issuer: string;
  accountName: string;
}

/**
 * Generate a new TOTP secret for 2FA setup
 */
export const generateTwoFactorSecret = (config: TwoFactorAuthConfig): TwoFactorAuthSecret => {
  const secret = TOTP.randomSecret();
  
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(config.accountName)}?secret=${secret}&issuer=${encodeURIComponent(config.issuer)}`;
  const manualEntryKey = secret;

  return {
    secret,
    qrCodeUrl: otpauthUrl,
    manualEntryKey,
  };
};

/**
 * Generate QR code data URL for the secret
 */
export const generateQRCodeDataURL = async (otpauthUrl: string): Promise<string> => {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    return qrCodeDataURL;
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Verify a TOTP token against a secret
 */
export const verifyTwoFactorToken = (secret: string, token: string): boolean => {
  try {
    const totp = new TOTP(secret);
    const isValid = totp.verify(token);
    return isValid;
  } catch (error) {
    return false;
  }
};

/**
 * Generate a backup code for 2FA recovery
 */
export const generateBackupCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generate multiple backup codes
 */
export const generateBackupCodes = (count: number = 8): string[] => {
  return Array.from({ length: count }, () => generateBackupCode());
};

/**
 * Validate backup code format
 */
export const isValidBackupCode = (code: string): boolean => {
  return /^[A-Z0-9]{8}$/.test(code);
};
