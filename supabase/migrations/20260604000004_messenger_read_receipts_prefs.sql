-- ============================================================================
-- PepNationLab Messenger Polish
-- Adds send_read_receipts to notification_preferences to allow users
-- to toggle whether their read status is broadcasted to others.
-- ============================================================================

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS send_read_receipts BOOLEAN DEFAULT true;
