-- Add encryption support to transactions table
-- This migration adds columns for encrypted transaction data

-- Add encryption columns to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS encrypted_data TEXT,
ADD COLUMN IF NOT EXISTS encryption_iv TEXT,
ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;

-- Create index for encrypted transactions
CREATE INDEX IF NOT EXISTS idx_transactions_encrypted ON transactions(is_encrypted) WHERE is_encrypted = true;

-- Add comment explaining the encryption structure
COMMENT ON COLUMN transactions.encrypted_data IS 'Encrypted transaction data (JSON)';
COMMENT ON COLUMN transactions.encryption_iv IS 'Initialization vector for AES-GCM encryption';
COMMENT ON COLUMN transactions.encryption_version IS 'Encryption algorithm version for future upgrades';
COMMENT ON COLUMN transactions.is_encrypted IS 'Flag indicating if transaction data is encrypted';

-- Create a view for easier querying of encrypted transactions
CREATE OR REPLACE VIEW encrypted_transactions AS
SELECT 
  id,
  user_id,
  encrypted_data,
  encryption_iv,
  encryption_version,
  is_encrypted,
  created_at
FROM transactions 
WHERE is_encrypted = true;

-- Grant permissions
GRANT SELECT ON encrypted_transactions TO authenticated;
