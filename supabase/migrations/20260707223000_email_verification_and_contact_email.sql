-- Email verification for public registration + a real (verified) contact email.
--
-- The auth identity stays username-based (auth.users.email remains
-- <username>@internal.auth so username login is untouched). We store the REAL
-- email separately on profiles.contact_email, verified via a single-use 6-digit
-- code delivered by email. This powers transactional email, recovery, and
-- marketing without changing the login model.
--
-- Applied to PepNationLab prod (ydsaqnnuwyvtyxgvrnys) on 2026-07-07 via MCP.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_contact_email
  ON public.profiles (lower(contact_email)) WHERE contact_email IS NOT NULL;

-- Codes are stored HASHED (sha256 of code + server pepper); the plaintext code
-- only ever exists in the delivered email. Rows are single-use and expire fast.
CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  purpose     TEXT NOT NULL DEFAULT 'signup',
  attempts    INT  NOT NULL DEFAULT 0,
  consumed    BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evc_email ON public.email_verification_codes (lower(email), purpose);
CREATE INDEX IF NOT EXISTS idx_evc_expires ON public.email_verification_codes (expires_at);

-- RLS: deny-all for anon/authenticated. All access is via the service role
-- (request-code + register API routes use createAdminClient, which bypasses RLS).
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_verification_codes FROM anon, authenticated;
