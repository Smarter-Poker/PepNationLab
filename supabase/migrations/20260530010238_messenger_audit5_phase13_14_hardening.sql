-- ============================================================================
-- PepNationLab Messenger Audit 5 (Phases 12-13-14)
-- Hardening for issues found in deep audit:
--   1. messenger_admin_messages insert policy was WITH CHECK (true) -- anyone
--      authenticated could spoof a mention row claiming any message_id /
--      conversation_id / sender_id. Tighten to require auth.uid() = sender_id
--      AND that the caller is actually the sender of the referenced message
--      AND a participant of the conversation.
--   2. messenger_admin_messages had no uniqueness on message_id -- the send
--      route's @admin detection could create duplicates on client retry. Add
--      a UNIQUE partial index so duplicate inserts are idempotent.
--   3. notification_preferences.browser_push DEFAULT was TRUE -- fresh rows
--      had push silently enabled which the opt-in banner is supposed to
--      gate. Flip the default to FALSE so the banner-driven opt-in is the
--      only path to enabled push.
-- ============================================================================

-- 1. Tighten the mention insert policy.
DROP POLICY IF EXISTS mam_insert_authenticated ON public.messenger_admin_messages;

CREATE POLICY mam_insert_authenticated ON public.messenger_admin_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messenger_messages m
      WHERE m.id = message_id
        AND m.sender_id = auth.uid()
        AND m.conversation_id = messenger_admin_messages.conversation_id
    )
    AND EXISTS (
      SELECT 1 FROM public.messenger_participants p
      WHERE p.conversation_id = messenger_admin_messages.conversation_id
        AND p.user_id = auth.uid()
    )
  );

-- 2. Idempotency: one admin-mention row per message.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mam_message_id
  ON public.messenger_admin_messages (message_id);

-- 3. browser_push default flips to FALSE so fresh prefs require explicit opt-in.
ALTER TABLE public.notification_preferences
  ALTER COLUMN browser_push SET DEFAULT false;
