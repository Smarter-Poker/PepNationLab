-- Add must_change_password flag to profiles
-- Set when an agent creates a researcher with a temp password.
-- Middleware redirects the researcher to /account/change-password on first login.
-- Cleared when they save a new password OR click "Skip and keep".

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
