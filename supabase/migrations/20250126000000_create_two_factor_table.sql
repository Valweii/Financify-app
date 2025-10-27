-- Create user_two_factor table for 2FA settings
CREATE TABLE IF NOT EXISTS user_two_factor (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  backup_codes TEXT[] DEFAULT '{}',
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_two_factor_user_id ON user_two_factor(user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE user_two_factor ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own 2FA settings" ON user_two_factor
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own 2FA settings" ON user_two_factor
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own 2FA settings" ON user_two_factor
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own 2FA settings" ON user_two_factor
  FOR DELETE USING (auth.uid() = user_id);
