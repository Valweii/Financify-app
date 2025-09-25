-- Create backup_codes table to store hashed backup codes for cross-device recovery
CREATE TABLE IF NOT EXISTS backup_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL, -- SHA-256 hash of the backup code
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE NULL, -- Track when code was used for recovery
  UNIQUE(user_id, code_hash)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_backup_codes_user_id ON backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_codes_code_hash ON backup_codes(code_hash);

-- Enable RLS
ALTER TABLE backup_codes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own backup codes" ON backup_codes
  FOR ALL USING (auth.uid() = user_id);
