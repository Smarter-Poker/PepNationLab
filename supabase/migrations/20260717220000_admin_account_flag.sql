-- Add is_admin_account flag to profiles
-- "Admin Account" type: can manage super agents and use network features
-- but does NOT have full platform admin access.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin_account boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_admin_account IS
  'Marks an account as an "Admin Account" — can manage super agents, view network orders, '
  'and access manufacturer-style dashboard features without having full platform admin access.';
