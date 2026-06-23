-- Add provisioned_password column to profiles
-- This stores the admin-set plaintext password for display in the admin UI.
-- Only accessible via service_role (admin server routes). Never exposed via RLS.
-- Cleared when an agent self-resets their password (via the change-password flow).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS provisioned_password TEXT DEFAULT NULL;

-- No RLS policy is added for this column.
-- The column is only read/written by server-side admin routes using the service_role key.
-- Regular agents cannot read or write this column through the client SDK.
COMMENT ON COLUMN public.profiles.provisioned_password IS 'Admin-set plaintext password for operational visibility. Only accessible via service_role. Null if agent has self-reset their password.';
