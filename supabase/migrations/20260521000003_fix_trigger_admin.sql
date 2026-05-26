-- ============================================
-- PEP NATION LAB — Fix Trigger + Create Admin
-- Run this in Supabase Dashboard ->SQL Editor
-- Project: pepnationlab-prod (ydsaqnnuwyvtyxgvrnys)
-- ============================================

-- STEP 1: Fix the handle_new_user trigger
-- The trigger was failing because it didn't handle
-- cases where the profile might already exist or
-- metadata is missing. Replacing with a safe version.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'researcher'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let trigger failures block user creation
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 2: Create the admin account
-- This uses Supabase's internal admin function to create the auth user,
-- then upserts the profile. Run STEP 1 first, then use the Dashboard
-- Auth UI or the script below.

-- After running STEP 1, go to:
-- Supabase Dashboard ->Authentication ->Users ->"Add user"
-- Email: daniel@bekavactrading.com
-- Password: 215SlalomCt!
-- Check "Auto Confirm User"
-- Click "Create User"

-- THEN run STEP 3 below (replace USER_UUID with the UUID shown after creation):

-- STEP 3: Set the admin role
-- Replace 'PASTE-USER-UUID-HERE' with the actual UUID from Step 2
/*
UPDATE public.profiles
SET
  role = 'admin',
  full_name = 'Daniel',
  disclaimer_v1_accepted = true,
  disclaimer_accepted_at = NOW(),
  is_active = true
WHERE email = 'daniel@bekavactrading.com';
*/

-- Or if profile doesn't exist yet:
/*
INSERT INTO public.profiles (id, email, full_name, role, disclaimer_v1_accepted, disclaimer_accepted_at, is_active)
SELECT
  id,
  email,
  'Daniel',
  'admin',
  true,
  NOW(),
  true
FROM auth.users
WHERE email = 'daniel@bekavactrading.com'
ON CONFLICT (id) DO UPDATE
  SET role = 'admin',
      full_name = 'Daniel',
      disclaimer_v1_accepted = true,
      is_active = true;
*/
