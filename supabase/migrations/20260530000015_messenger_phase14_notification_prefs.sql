-- ============================================================================
-- PepNationLab Messenger Phase 14 - notification preferences extensions.
-- Adds a hidden email_digest_messenger column for future use. The platform
-- has a zero-email rule today (lib/email.ts is a no-op shim), so the column
-- exists only as a placeholder; nothing reads it yet.
--
-- This migration is idempotent: every ALTER uses ADD COLUMN IF NOT EXISTS
-- so re-runs against a partial schema are safe.
-- ============================================================================

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_digest_messenger BOOLEAN DEFAULT false;

-- Defensive: ensure browser_push exists (older migrations should have added it,
-- but in case the table existed in a partial state we guarantee it here).
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS browser_push BOOLEAN DEFAULT false;

-- Defensive: ensure mute_all exists for the same reason.
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS mute_all BOOLEAN DEFAULT false;

-- RLS is already enabled on the table with two policies (one created by
-- phase15_messaging_inventory, one by phase2_schema_alignment) both gating to
-- user_id = auth.uid(). We leave them in place; no overlap, no new policy.
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
