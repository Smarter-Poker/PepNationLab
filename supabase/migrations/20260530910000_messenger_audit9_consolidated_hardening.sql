-- ============================================================================
-- Messenger Audit 9 — Consolidated Phase 0-15 Hardening (2026-05-30)
-- Canonical source of truth — already applied to ydsaqnnuwyvtyxgvrnys via MCP.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.messenger_messages REPLICA IDENTITY FULL;
ALTER TABLE public.messenger_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.messenger_participants REPLICA IDENTITY FULL;
ALTER TABLE public.messenger_calls REPLICA IDENTITY FULL;
ALTER TABLE public.messenger_pins REPLICA IDENTITY FULL;
ALTER TABLE public.messenger_reminders REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messenger_conversations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_conversations;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messenger_pins') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_pins;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messenger_reminders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_reminders;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messenger_blocked') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_blocked;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mm_text_trgm
  ON public.messenger_messages USING gin (text public.gin_trgm_ops)
  WHERE is_deleted = false AND text IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mm_conv_not_deleted
  ON public.messenger_messages (conversation_id, created_at DESC)
  WHERE is_deleted = false;

ALTER TABLE public.messenger_messages ADD COLUMN IF NOT EXISTS client_message_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mm_conv_sender_clientmsg
  ON public.messenger_messages (conversation_id, sender_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.fn_get_user_conversations(uuid);

CREATE FUNCTION public.fn_get_user_conversations(p_user UUID)
RETURNS TABLE (
  conversation_id UUID,
  type TEXT,
  title TEXT,
  avatar_url TEXT,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER,
  is_pinned BOOLEAN,
  is_muted BOOLEAN,
  counterparty_id UUID,
  counterparty_full_name TEXT,
  counterparty_username TEXT,
  counterparty_role TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller UUID := auth.uid();
  caller_role_in_jwt TEXT;
  caller_profile_role TEXT;
BEGIN
  caller_role_in_jwt := auth.role();
  IF caller_role_in_jwt = 'service_role' THEN
    NULL;
  ELSIF caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501';
  ELSIF p_user IS DISTINCT FROM caller THEN
    SELECT role::TEXT INTO caller_profile_role FROM public.profiles WHERE id = caller;
    IF caller_profile_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    c.id AS conversation_id,
    c.type::TEXT,
    c.title,
    c.avatar_url,
    c.last_message_text,
    c.last_message_at,
    p.unread_count,
    p.is_pinned,
    p.is_muted,
    cp.user_id AS counterparty_id,
    cprofile.full_name AS counterparty_full_name,
    cprofile.username AS counterparty_username,
    cprofile.role::TEXT AS counterparty_role
  FROM public.messenger_participants p
  JOIN public.messenger_conversations c ON c.id = p.conversation_id
  LEFT JOIN LATERAL (
    SELECT user_id FROM public.messenger_participants
    WHERE conversation_id = c.id AND user_id <> p_user AND c.type = 'direct'
    LIMIT 1
  ) cp ON true
  LEFT JOIN public.profiles cprofile ON cprofile.id = cp.user_id
  WHERE p.user_id = p_user
    AND c.is_archived = false
    AND COALESCE((p.settings ->> 'archived')::boolean, false) = false
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT 200;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_get_user_conversations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_user_conversations(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.fn_find_direct_conversation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_find_direct_conversation(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS mam_insert_authenticated ON public.messenger_admin_messages;
CREATE POLICY mam_insert_authenticated ON public.messenger_admin_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.messenger_messages m WHERE m.id = message_id AND m.sender_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.messenger_participants p WHERE p.conversation_id = messenger_admin_messages.conversation_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage own prefs" ON public.notification_preferences;

DROP POLICY IF EXISTS meh_insert_admin ON public.messenger_edit_history;
DROP POLICY IF EXISTS meh_insert_self ON public.messenger_edit_history;
CREATE POLICY meh_insert_self ON public.messenger_edit_history
  FOR INSERT TO authenticated
  WITH CHECK (
    edited_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.messenger_messages m WHERE m.id = messenger_edit_history.message_id AND m.sender_id = auth.uid())
  );

DROP POLICY IF EXISTS mc_update_admins ON public.messenger_conversations;
CREATE POLICY mc_update_admins ON public.messenger_conversations
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messenger_participants p WHERE p.conversation_id = id AND p.user_id = auth.uid() AND p.role IN ('owner','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.messenger_participants p WHERE p.conversation_id = id AND p.user_id = auth.uid() AND p.role IN ('owner','admin')));

DROP POLICY IF EXISTS mm_update_self ON public.messenger_messages;
CREATE POLICY mm_update_self ON public.messenger_messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.messenger_participants p WHERE p.conversation_id = conversation_id AND p.user_id = auth.uid())
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='messenger_messages_payload_present' AND conrelid='public.messenger_messages'::regclass) THEN
    ALTER TABLE public.messenger_messages ADD CONSTRAINT messenger_messages_payload_present
      CHECK (
        is_deleted = true
        OR message_type = 'system'
        OR (text IS NOT NULL AND length(text) > 0)
        OR (media_url IS NOT NULL AND length(media_url) > 0)
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='messenger_reactions_type_consistent' AND conrelid='public.messenger_reactions'::regclass) THEN
    ALTER TABLE public.messenger_reactions ADD CONSTRAINT messenger_reactions_type_consistent
      CHECK (
        (reaction_type='emoji' AND emoji IS NOT NULL AND gif_url IS NULL)
        OR (reaction_type='gif' AND gif_url IS NOT NULL AND emoji IS NULL)
      ) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_mm_after_insert() RETURNS trigger AS $$
BEGIN
  IF NEW.thread_parent_id IS NOT NULL THEN RETURN NEW; END IF;
  UPDATE public.messenger_conversations
     SET last_message_text = LEFT(COALESCE(NULLIF(NEW.text, ''), '[' || NEW.message_type || ']'), 200),
         last_message_at = NEW.created_at,
         updated_at = now()
   WHERE id = NEW.conversation_id;
  UPDATE public.messenger_participants
     SET unread_count = unread_count + 1
   WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- (fn_messenger_mark_read, fn_is_blocked_either, fn_messenger_create_conversation,
--  fn_mpins_enforce_cap + trigger, and supporting indexes were applied via MCP
--  in audit9 / audit9b; they are not re-stated here to keep migration order tight.)

CREATE INDEX IF NOT EXISTS idx_mpins_conv ON public.messenger_pins (conversation_id);
CREATE INDEX IF NOT EXISTS idx_mrem_user_status ON public.messenger_reminders (user_id, status);

COMMENT ON SCHEMA public IS 'PepNationLab production. Last messenger audit: 9 (2026-05-30) — cross-phase consolidated hardening.';
