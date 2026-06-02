-- Migration: Profile Refactor and Fake Email Removal

-- 1. Add first_name and last_name to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 2. Migrate existing full_name data into first_name and last_name
UPDATE profiles 
SET 
  first_name = split_part(full_name, ' ', 1),
  last_name = CASE 
    WHEN strpos(full_name, ' ') > 0 THEN substr(full_name, strpos(full_name, ' ') + 1)
    ELSE NULL
  END
WHERE full_name IS NOT NULL AND (first_name IS NULL OR last_name IS NULL);

-- 3. Update handle_new_user trigger to populate first_name/last_name and handle @internal.auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_first_name := split_part(v_full_name, ' ', 1);
  IF strpos(v_full_name, ' ') > 0 THEN
    v_last_name := substr(v_full_name, strpos(v_full_name, ' ') + 1);
  ELSE
    v_last_name := NULL;
  END IF;

  INSERT INTO profiles (id, email, full_name, first_name, last_name, role)
  VALUES (
    NEW.id,
    CASE WHEN NEW.email LIKE '%@internal.auth' THEN NULL ELSE NEW.email END,
    v_full_name,
    v_first_name,
    v_last_name,
    'researcher'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update auth.users to replace @pepnationlab.com with @internal.auth (except for real admin emails)
-- Run this as an anonymous block to catch errors if auth.users is protected, though migrations run as postgres user.
DO $$ 
BEGIN
  UPDATE auth.users 
  SET email = replace(email, '@pepnationlab.com', '@internal.auth') 
  WHERE email LIKE '%@pepnationlab.com' 
  AND email NOT IN ('daniel@pepnationlab.com', 'admin@pepnationlab.com', 'support@pepnationlab.com', 'research@pepnationlab.com');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not update auth.users, possibly due to permission restrictions.';
END $$;

-- 5. Update profiles to set email = NULL for those that were synthetic
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;

UPDATE profiles 
SET email = NULL 
WHERE email LIKE '%@pepnationlab.com' 
AND email NOT IN ('daniel@pepnationlab.com', 'admin@pepnationlab.com', 'support@pepnationlab.com', 'research@pepnationlab.com');

UPDATE profiles 
SET email = NULL 
WHERE email LIKE '%@internal.auth';
