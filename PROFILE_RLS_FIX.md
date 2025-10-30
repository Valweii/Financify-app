# Fix Profile Update Issue - RLS Policy Configuration

## 🐛 Problem
Users cannot update their username/full name in the Profile Information settings because the `profiles` table doesn't have Row Level Security (RLS) policies configured. This prevents authenticated users from updating their own profile data.

## ✅ Solution
Enable RLS and add appropriate policies to allow users to manage their own profile data.

---

## 🚀 How to Apply the Fix

### Option 1: Using Supabase CLI (Recommended)

If you're using Supabase locally or have CLI access:

```bash
# Run the new migration
supabase db reset

# Or push specific migration
supabase db push
```

The migration file has been created at:
```
supabase/migrations/20250130000000_add_profiles_rls_policies.sql
```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `fix_profiles_rls.sql` (created in your project root)
4. Paste into the SQL Editor
5. Click **Run** to execute

### Option 3: Direct SQL Execution

Run the following SQL directly in your Supabase SQL Editor:

```sql
-- Enable Row Level Security on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy: Users can delete their own profile (optional)
CREATE POLICY "Users can delete their own profile" ON profiles
  FOR DELETE USING (auth.uid() = id);
```

---

## 🔍 What These Policies Do

### 1. **SELECT Policy** - View Own Profile
```sql
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
```
- Allows users to read their own profile data
- `auth.uid()` is the authenticated user's ID
- Only returns rows where `id` matches the current user

### 2. **UPDATE Policy** - Edit Own Profile ✨
```sql
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```
- **This is the key policy that fixes your issue**
- Allows users to update their `full_name`, `email`, etc.
- Only permits updates to the user's own profile row

### 3. **INSERT Policy** - Create Profile During Signup
```sql
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```
- Allows the signup trigger to create profiles
- Works with your existing `handle_new_user()` trigger function

### 4. **DELETE Policy** - Remove Own Profile (Optional)
```sql
CREATE POLICY "Users can delete their own profile" ON profiles
  FOR DELETE USING (auth.uid() = id);
```
- Optional: Allows users to delete their own profile
- Useful if you implement account deletion feature

---

## 🧪 Testing the Fix

After applying the migration, test the profile update:

1. **Sign in** to your Financify app
2. Go to **Settings** → **Profile Information**
3. Change your **Full Name** to a new value
4. Click **Save**
5. ✅ The update should now succeed!

You should see a success toast: **"Profile updated"**

---

## 📊 Verify Policies

To verify the policies were created successfully, run this query in Supabase SQL Editor:

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies 
WHERE tablename = 'profiles';
```

You should see 4 policies:
- ✅ Users can view their own profile (SELECT)
- ✅ Users can update their own profile (UPDATE)
- ✅ Users can insert their own profile (INSERT)
- ✅ Users can delete their own profile (DELETE)

---

## 🔒 Security Benefits

These RLS policies ensure:
- ✅ Users can ONLY see their own profile
- ✅ Users can ONLY edit their own profile
- ✅ Users CANNOT access or modify other users' profiles
- ✅ All database operations are secured at the database level
- ✅ Even if client-side code is compromised, the database enforces security

---

## 📝 Additional Notes

### Existing Data
All existing profiles remain intact. The policies only control **access permissions**, not the data itself.

### Other Tables
Your other tables already have proper RLS policies:
- ✅ `transactions` 
- ✅ `backup_codes`
- ✅ `user_two_factor`
- ✅ `split_bill_history`

The `profiles` table was missing these policies, which is now fixed.

### Trigger Function
Your existing `handle_new_user()` trigger function has `SECURITY DEFINER` which allows it to bypass RLS when creating profiles during signup. The INSERT policy provides an additional layer of security.

---

## 🎉 Result

After applying this fix:
- ✅ Users can update their profile information
- ✅ Username changes persist in the database
- ✅ Profile updates appear immediately in the UI
- ✅ Security is maintained with proper RLS policies
- ✅ Each user can only access and modify their own data

---

## 📚 Learn More

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)


