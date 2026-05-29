-- ============================================================================
-- Secondary audit fixes for Messenger Phase 10 / 11 / 12.
-- Applied to Supabase ydsaqnnuwyvtyxgvrnys as messenger_audit2_p10_p11_p12_hardening.
--
-- 1. Tighten UPDATE policies so participants cannot re-attribute rows
--    (messenger_scheduled, messenger_calls were USING-only -- no WITH CHECK).
-- 2. Make messenger_reports.reporter_id nullable so the
--    ON DELETE SET NULL contract actually works on auth.users deletion.
-- 3. Make fn_mm_after_insert ignore thread replies so they don't bump main
--    conversation last_message_* / unread_count for other participants.
-- 4. Add hot-path indexes the first audit missed.
-- 5. Auto-cleanup pins when the underlying message is soft-deleted for
--    everyone (covers admin moderation + user delete-for-everyone).
-- ============================================================================

-- 1. messenger_scheduled UPDATE: add WITH CHECK.
DROP POLICY IF EXISTS msc_update_self ON public.messenger_scheduled;
CREATE POLICY msc_update_self ON public.messenger_scheduled
  FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- 2. messenger_calls UPDATE: add WITH CHECK.
DROP POLICY IF EXISTS calls_update_participants ON public.messenger_calls;
CREATE POLICY calls_update_participants ON public.messenger_calls
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.messenger_participants p
              WHERE p.conversation_id = messenger_calls.conversation_id
                AND p.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.messenger_participants p
              WHERE p.conversation_id = messenger_calls.conversation_id
                AND p.user_id = auth.uid())
  );

-- 3. messenger_reports.reporter_id was NOT NULL but FK is ON DELETE SET NULL.
--    Deleting an auth.users row that had reports would otherwise abort the
--    cascade with "null value in column reporter_id violates not-null".
ALTER TABLE public.messenger_reports
  ALTER COLUMN reporter_id DROP NOT NULL;

-- 4. fn_mm_after_insert: skip thread replies so they do not bump the main
--    conversation banner or increment unread for other participants.
CREATE OR REPLACE FUNCTION public.fn_mm_after_insert() RETURNS trigger AS $$
BEGIN
  IF NEW.thread_parent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.messenger_conversations
     SET last_message_text = LEFT(COALESCE(NEW.text, '[' || NEW.message_type || ']'), 200),
         last_message_at = NEW.created_at,
         updated_at = now()
   WHERE id = NEW.conversation_id;

  UPDATE public.messenger_participants
     SET unread_count = unread_count + 1
   WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Hot-path indexes.
CREATE INDEX IF NOT EXISTS idx_mcl_calls_conv_status
  ON public.messenger_calls (conversation_id, status);
CREATE INDEX IF NOT EXISTS idx_mrpt_reporter_status
  ON public.messenger_reports (reporter_id, status);

-- 6. Auto-cleanup pins on soft-delete for-everyone.
CREATE OR REPLACE FUNCTION public.fn_mm_cleanup_pins_on_delete() RETURNS trigger AS $$
BEGIN
  IF (NEW.is_deleted = true AND NEW.delete_scope = 'for_everyone')
     AND (OLD.is_deleted = false OR OLD.delete_scope IS DISTINCT FROM 'for_everyone') THEN
    DELETE FROM public.messenger_pins WHERE message_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_mm_cleanup_pins ON public.messenger_messages;
CREATE TRIGGER trg_mm_cleanup_pins AFTER UPDATE ON public.messenger_messages
FOR EACH ROW EXECUTE FUNCTION public.fn_mm_cleanup_pins_on_delete();
