-- ============================================================================
-- Messenger Audit 10 -- Follow-up to Audit 9 (2026-05-30)
-- Mirror of the body applied to ydsaqnnuwyvtyxgvrnys via MCP.
-- ============================================================================

-- 1. CRITICAL -- fix mc_update_admins subquery column shadowing
DROP POLICY IF EXISTS mc_update_admins ON public.messenger_conversations;
CREATE POLICY mc_update_admins ON public.messenger_conversations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messenger_participants p
       WHERE p.conversation_id = messenger_conversations.id
         AND p.user_id = auth.uid()
         AND p.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messenger_participants p
       WHERE p.conversation_id = messenger_conversations.id
         AND p.user_id = auth.uid()
         AND p.role IN ('owner','admin')
    )
  );

-- 2. CRITICAL -- fix mm_update_self WITH CHECK tautology
DROP POLICY IF EXISTS mm_update_self ON public.messenger_messages;
CREATE POLICY mm_update_self ON public.messenger_messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messenger_participants p
       WHERE p.conversation_id = messenger_messages.conversation_id
         AND p.user_id = auth.uid()
    )
  );

-- 3. CRITICAL -- unique index for report dedup
CREATE UNIQUE INDEX IF NOT EXISTS messenger_reports_reporter_message_uq
  ON public.messenger_reports (reporter_id, message_id)
  WHERE reporter_id IS NOT NULL;

-- 4. HIGH -- REPLICA IDENTITY FULL on missing tables
ALTER TABLE public.messenger_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messenger_blocked REPLICA IDENTITY FULL;

-- 5. HIGH -- broaden fn_get_user_conversations service-role bypass
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

  IF caller_role_in_jwt = 'service_role'
     OR current_user IN ('postgres','supabase_admin')
  THEN
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

-- 6. MEDIUM -- VALIDATE the two CHECK constraints
ALTER TABLE public.messenger_messages VALIDATE CONSTRAINT messenger_messages_payload_present;
ALTER TABLE public.messenger_reactions VALIDATE CONSTRAINT messenger_reactions_type_consistent;

-- 7. MEDIUM -- restrict messenger_admin_messages SELECT/UPDATE to authenticated
ALTER POLICY mam_select_admin ON public.messenger_admin_messages TO authenticated;
ALTER POLICY mam_update_admin ON public.messenger_admin_messages TO authenticated;

-- 8. MEDIUM -- fn_mpins_enforce_cap defensive hardening
CREATE OR REPLACE FUNCTION public.fn_mpins_enforce_cap() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cnt INTEGER;
BEGIN
  SELECT count(*) INTO cnt FROM public.messenger_pins WHERE conversation_id = NEW.conversation_id;
  IF cnt >= 10 THEN RAISE EXCEPTION 'pin_cap_exceeded' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_mpins_cap ON public.messenger_pins;
CREATE TRIGGER trg_mpins_cap BEFORE INSERT ON public.messenger_pins
FOR EACH ROW EXECUTE FUNCTION public.fn_mpins_enforce_cap();

-- 9. MEDIUM -- fn_messenger_create_conversation invariants
CREATE OR REPLACE FUNCTION public.fn_messenger_create_conversation(
  p_type TEXT, p_title TEXT, p_avatar TEXT, p_participant_ids UUID[]
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller UUID := auth.uid();
  new_conv_id UUID;
  uid UUID;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501'; END IF;
  IF p_type NOT IN ('direct','group','announcement') THEN
    RAISE EXCEPTION 'invalid_type' USING ERRCODE='22023';
  END IF;
  IF array_length(p_participant_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'empty_participants' USING ERRCODE='22023';
  END IF;
  IF NOT (caller = ANY(p_participant_ids)) THEN
    RAISE EXCEPTION 'caller_not_in_participants' USING ERRCODE='22023';
  END IF;
  IF p_type = 'direct' AND array_length(p_participant_ids, 1) <> 2 THEN
    RAISE EXCEPTION 'direct_requires_two' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.messenger_conversations (type, title, avatar_url, created_by)
  VALUES (p_type, p_title, p_avatar, caller)
  RETURNING id INTO new_conv_id;

  FOREACH uid IN ARRAY p_participant_ids LOOP
    INSERT INTO public.messenger_participants (conversation_id, user_id, role, last_read_at)
    VALUES (
      new_conv_id, uid,
      CASE WHEN p_type='direct' THEN 'member'
           WHEN uid=caller THEN 'owner'
           ELSE 'member' END,
      CASE WHEN uid=caller THEN now() ELSE NULL END
    )
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;

  RETURN new_conv_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_messenger_create_conversation(text,text,text,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_messenger_create_conversation(text,text,text,uuid[]) TO authenticated, service_role;

-- 10. MEDIUM -- fn_find_direct_conversation caller-membership gate
CREATE OR REPLACE FUNCTION public.fn_find_direct_conversation(a UUID, b UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller UUID := auth.uid();
  caller_role_in_jwt TEXT := auth.role();
  found_id UUID;
BEGIN
  IF caller_role_in_jwt = 'service_role'
     OR current_user IN ('postgres','supabase_admin')
  THEN
    NULL;
  ELSIF caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501';
  ELSIF caller NOT IN (a, b) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  SELECT c.id INTO found_id
  FROM public.messenger_conversations c
  JOIN public.messenger_participants pa ON pa.conversation_id = c.id AND pa.user_id = a
  JOIN public.messenger_participants pb ON pb.conversation_id = c.id AND pb.user_id = b
  WHERE c.type = 'direct'
  LIMIT 1;
  RETURN found_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_find_direct_conversation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_find_direct_conversation(uuid, uuid) TO authenticated, service_role;

COMMENT ON SCHEMA public IS 'PepNationLab production. Last messenger audit: 10 (2026-05-30) -- audit9 RLS-shadow fix, report uniqueness, replica identity, RPC invariants.';
