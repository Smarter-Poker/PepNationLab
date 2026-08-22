-- Email system hardening (SENTINEL email/notification audit 2026-07-12).
--
-- 1. profiles.email_opt_out: marketing-email opt-out flag behind the public
--    one-click /api/unsubscribe endpoint (CAN-SPAM / RFC 8058). Marketing
--    senders (abandoned-cart recovery, product alerts) gate on it;
--    transactional mail ignores it.
-- 2. email_log: append-only send telemetry written best-effort by
--    lib/email.ts sendEmail() so delivery failures are visible and
--    recoverable instead of vanishing into serverless stdout. Service-role
--    only (RLS enabled, no policies).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_opt_out boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.email_opt_out IS
  'Marketing-email opt-out set by /api/unsubscribe (one-click). Transactional email is unaffected.';

CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  subject text NOT NULL,
  template text,
  ok boolean NOT NULL,
  skipped boolean NOT NULL DEFAULT false,
  provider_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_log IS
  'Append-only transactional email send log written by lib/email.ts (best-effort). Service-role only.';

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
-- Deny-all on purpose: no anon/authenticated policies. The service role
-- bypasses RLS; nothing else may read or write send telemetry.

CREATE INDEX IF NOT EXISTS email_log_created_at_idx ON public.email_log (created_at DESC);
CREATE INDEX IF NOT EXISTS email_log_recipient_idx ON public.email_log (recipient);
CREATE INDEX IF NOT EXISTS email_log_ok_idx ON public.email_log (ok) WHERE ok = false;
