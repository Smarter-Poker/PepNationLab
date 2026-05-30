-- ============================================================
-- Sweep 15: Add 'video' to messenger_messages.message_type CHECK
--           + extend messenger_media storage bucket for video
-- ============================================================
-- The video upload feature (MOV/MP4/WebM from AttachMenu) uses
-- message_type = 'video'. The original phase-0 schema did not
-- include 'video' in the CHECK constraint, causing DB inserts to
-- fail with a check violation.
--
-- Also: the messenger_media storage bucket was created with a
-- 50 MB file_size_limit (52428800 bytes). Video uploads can be
-- up to 200 MB, so we patch the bucket row to 209715200 bytes.
-- ============================================================

-- ── 1. messenger_messages CHECK ─────────────────────────────────────────────
ALTER TABLE public.messenger_messages
  DROP CONSTRAINT IF EXISTS messenger_messages_message_type_check;

ALTER TABLE public.messenger_messages
  ADD CONSTRAINT messenger_messages_message_type_check
  CHECK (message_type IN (
    'text','image','gif','voice','video','file',
    'contact_card','location','poll','system'
  ));

-- ── 2. messenger_scheduled_messages CHECK ───────────────────────────────────
ALTER TABLE public.messenger_scheduled_messages
  DROP CONSTRAINT IF EXISTS messenger_scheduled_messages_message_type_check;

ALTER TABLE public.messenger_scheduled_messages
  ADD CONSTRAINT messenger_scheduled_messages_message_type_check
  CHECK (message_type IN ('text','image','gif','voice','video','file'));

-- ── 3. Extend messenger_media bucket for video ──────────────────────────────
-- file_size_limit: 209715200 = 200 MB (videos can be large)
-- allowed_mime_types: add video/quicktime (MOV) and video/x-m4v
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
