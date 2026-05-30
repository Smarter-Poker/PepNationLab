-- ============================================================================
-- Fourth audit pass for Messenger Phase 10 / 11 / 12.
-- Applied to Supabase ydsaqnnuwyvtyxgvrnys as
--   messenger_audit4_p10_p11_p12_fk_cascade_and_locks.
--
-- 1. messenger_messages.sender_id was ON DELETE CASCADE. Deleting an
--    auth.users row would wipe every message they ever sent, blowing
--    holes in conversation history for everyone else. Switch to SET NULL.
--    Sender label rendering falls back to "Deleted User" when sender_id
--    is null (handled by Pass 2 reporter_id pattern); the conversation
--    record stays intact.
-- 2. messenger_reports.resolved_by had NO ACTION (default), which means
--    deleting an admin who resolved a report would silently fail to
--    cascade. Switch to SET NULL so admin churn doesn't break user delete.
-- 3. messenger_calls.initiator_id: same story. Switch to SET NULL so we
--    keep historical call records (duration etc.) when an account is
--    purged.
-- 4. messenger_edit_history.edited_by is already SET NULL - no change.
-- ============================================================================

-- 1. messenger_messages.sender_id -> SET NULL
ALTER TABLE public.messenger_messages
  DROP CONSTRAINT IF EXISTS messenger_messages_sender_id_fkey;
ALTER TABLE public.messenger_messages
  ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE public.messenger_messages
  ADD CONSTRAINT messenger_messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. messenger_reports.resolved_by -> SET NULL
ALTER TABLE public.messenger_reports
  DROP CONSTRAINT IF EXISTS messenger_reports_resolved_by_fkey;
ALTER TABLE public.messenger_reports
  ADD CONSTRAINT messenger_reports_resolved_by_fkey
  FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. messenger_calls.initiator_id -> SET NULL
ALTER TABLE public.messenger_calls
  DROP CONSTRAINT IF EXISTS messenger_calls_initiator_id_fkey;
ALTER TABLE public.messenger_calls
  ALTER COLUMN initiator_id DROP NOT NULL;
ALTER TABLE public.messenger_calls
  ADD CONSTRAINT messenger_calls_initiator_id_fkey
  FOREIGN KEY (initiator_id) REFERENCES auth.users(id) ON DELETE SET NULL;
