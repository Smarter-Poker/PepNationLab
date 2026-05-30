-- ============================================================
-- Fix: Apply video message_type + resolve policy conflicts
-- This migration safely applies what was blocked by the 
-- policy-already-exists error in migration 20260530000018
-- ============================================================

-- ── 1. Fix messenger_participants policy conflict ─────────────────────────────
-- Drop and recreate safely to resolve the "already exists" error
DROP POLICY IF EXISTS mp_insert_self_or_admin ON public.messenger_participants;
DROP POLICY IF EXISTS mp_insert_admin ON public.messenger_participants;

CREATE POLICY mp_insert_self_or_admin ON public.messenger_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.fn_messenger_is_admin_or_owner(conversation_id, auth.uid())
  );

-- ── 2. Add 'video' to messenger_messages CHECK ────────────────────────────────
ALTER TABLE public.messenger_messages
  DROP CONSTRAINT IF EXISTS messenger_messages_message_type_check;

ALTER TABLE public.messenger_messages
  ADD CONSTRAINT messenger_messages_message_type_check
  CHECK (message_type IN (
    'text','image','gif','voice','video','file',
    'contact_card','location','poll','system'
  ));

-- ── 3. Add 'video' to messenger_scheduled CHECK ───────────────────────────────
ALTER TABLE public.messenger_scheduled
  DROP CONSTRAINT IF EXISTS messenger_scheduled_message_type_check;

ALTER TABLE public.messenger_scheduled
  ADD CONSTRAINT messenger_scheduled_message_type_check
  CHECK (message_type IN ('text','image','gif','voice','video','file'));

-- ── 4. Extend messenger_media storage bucket for video ────────────────────────
-- file_size_limit: 209715200 = 200 MB
-- Adds video/quicktime (MOV from iPhone) and video/x-m4v
UPDATE storage.buckets
SET
  file_size_limit = 209715200,
  allowed_mime_types = array[
    'image/jpeg','image/png','image/gif','image/webp',
    'video/mp4','video/webm','video/quicktime','video/x-m4v',
    'audio/webm','audio/mp4','audio/mpeg',
    'application/pdf'
  ]
WHERE id = 'messenger_media';
