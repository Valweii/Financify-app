-- Create split_bill_history table
CREATE TABLE IF NOT EXISTS split_bill_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_amount_cents INTEGER NOT NULL,
  people JSONB NOT NULL,
  items JSONB NOT NULL,
  tax_choice TEXT NOT NULL CHECK (tax_choice IN ('none', '10', '11')),
  service_fee_cents INTEGER NOT NULL DEFAULT 0,
  person_totals JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_split_bill_history_user_id ON split_bill_history(user_id);
CREATE INDEX IF NOT EXISTS idx_split_bill_history_date ON split_bill_history(date);
CREATE INDEX IF NOT EXISTS idx_split_bill_history_created_at ON split_bill_history(created_at);

-- Enable RLS
ALTER TABLE split_bill_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own split bill history" ON split_bill_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own split bill history" ON split_bill_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own split bill history" ON split_bill_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own split bill history" ON split_bill_history
  FOR DELETE USING (auth.uid() = user_id);
