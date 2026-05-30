-- ============================================================
-- Sweep 15: Add 'video' to messenger_messages.message_type CHECK
-- ============================================================
-- The video upload feature (MOV/MP4/WebM from AttachMenu) uses
-- message_type = 'video'. The original phase-0 schema did not
-- include 'video' in the CHECK constraint, causing DB inserts to
-- fail with a check violation.
--
-- ALTER TABLE … DROP CONSTRAINT … ADD CONSTRAINT is the safe way
-- to modify a CHECK in Postgres. We use the existing constraint
-- name from phase-0 (messenger_messages_message_type_check).
-- If it doesn't exist yet (fresh deploys run all migrations in
-- order, so it will always exist), the DROP is a no-op with IF EXISTS.
-- ============================================================

ALTER TABLE public.messenger_messages
  DROP CONSTRAINT IF EXISTS messenger_messages_message_type_check;

ALTER TABLE public.messenger_messages
  ADD CONSTRAINT messenger_messages_message_type_check
  CHECK (message_type IN (
    'text','image','gif','voice','video','file',
    'contact_card','location','poll','system'
  ));

-- The scheduled_messages table has its own CHECK (phase-10).
-- Patch it the same way so scheduled video messages also work.
ALTER TABLE public.messenger_scheduled_messages
  DROP CONSTRAINT IF EXISTS messenger_scheduled_messages_message_type_check;

ALTER TABLE public.messenger_scheduled_messages
  ADD CONSTRAINT messenger_scheduled_messages_message_type_check
  CHECK (message_type IN ('text','image','gif','voice','video','file'));
