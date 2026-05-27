-- Add username column to profiles
-- Agents and researchers log in with username instead of email
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Index for fast username lookup at login time
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Set MIDWAY agent's username (account exists with email midway@pepnationlab.com)
UPDATE profiles SET username = 'midway' WHERE email = 'midway@pepnationlab.com';
