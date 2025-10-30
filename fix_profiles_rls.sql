-- ========================================
-- FIX PROFILES TABLE RLS POLICIES
-- ========================================
-- This script enables RLS and creates necessary policies
-- for the profiles table to allow users to edit their own data.
--
-- Run this script in your Supabase SQL Editor or via CLI
-- ========================================

-- Enable Row Level Security on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (in case you're re-running this)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT 
  USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE 
  USING (auth.uid() = id);

-- Policy 3: Users can insert their own profile (for signup trigger)
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Policy 4: Users can delete their own profile (optional)
CREATE POLICY "Users can delete their own profile" ON profiles
  FOR DELETE 
  USING (auth.uid() = id);

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'profiles';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'RLS policies for profiles table have been created successfully!';
  RAISE NOTICE 'Users can now update their own profile information.';
END $$;


