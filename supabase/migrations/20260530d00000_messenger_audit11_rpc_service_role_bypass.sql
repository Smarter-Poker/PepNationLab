-- ============================================================================
-- Audit 11 -- Mirror of the body applied to ydsaqnnuwyvtyxgvrnys via MCP.
-- Fixes P0: fn_messenger_mark_read and fn_messenger_create_conversation
-- both bailed when auth.uid() IS NULL. Routes call them via createServiceClient()
-- which has no end-user JWT, so they were broken since audit10.
-- ============================================================================

DROP FUNCTION IF EXISTS public.fn_messenger_mark_read(uuid, uuid);

CREATE OR REPLACE FUNCTION public.fn_messenger_mark_read(
  p_caller_id UUID,
  p_conv_id UUID,
  p_last_msg_id UUID
) RETURNS TABLE (
  last_read_at TIMESTAMPTZ,
  last_read_message_id UUID,
  unread_count INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller UUID := auth.uid();
  caller_role_in_jwt TEXT := auth.role();
  effective_caller UUID;
  msg_ts TIMESTAMPTZ;
  msg_conv UUID;
BEGIN
  IF caller_role_in_jwt = 'service_role'
     OR current_user IN ('postgres','supabase_admin')
  THEN
    IF p_caller_id IS NULL THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501';
    END IF;
    effective_caller := p_caller_id;
  ELSE
    IF caller IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501'; END IF;
    IF p_caller_id IS DISTINCT FROM caller THEN
      RAISE EXCEPTION 'caller_mismatch' USING ERRCODE='42501';
    END IF;
    effective_caller := caller;
  END IF;

  SELECT created_at, conversation_id INTO msg_ts, msg_conv
    FROM public.messenger_messages WHERE id = p_last_msg_id;
  IF msg_conv IS DISTINCT FROM p_conv_id THEN
    RAISE EXCEPTION 'message_not_in_conversation' USING ERRCODE='22023';
  END IF;

  UPDATE public.messenger_participants p
     SET last_read_at = GREATEST(COALESCE(p.last_read_at, msg_ts), msg_ts),
         last_read_message_id = CASE
           WHEN p.last_read_at IS NULL OR msg_ts >= p.last_read_at THEN p_last_msg_id
           ELSE p.last_read_message_id
         END,
         unread_count = 0
   WHERE p.conversation_id = p_conv_id AND p.user_id = effective_caller
  RETURNING p.last_read_at, p.last_read_message_id, p.unread_count
    INTO last_read_at, last_read_message_id, unread_count;
  IF last_read_at IS NULL THEN RAISE EXCEPTION 'not_a_participant' USING ERRCODE='42501'; END IF;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_messenger_mark_read(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_messenger_mark_read(uuid, uuid, uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.fn_messenger_create_conversation(text, text, text, uuid[]);

CREATE OR REPLACE FUNCTION public.fn_messenger_create_conversation(
  p_caller_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_avatar TEXT,
  p_participant_ids UUID[]
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller UUID := auth.uid();
  caller_role_in_jwt TEXT := auth.role();
  effective_caller UUID;
  new_conv_id UUID;
  uid UUID;
BEGIN
  IF caller_role_in_jwt = 'service_role'
     OR current_user IN ('postgres','supabase_admin')
  THEN
    IF p_caller_id IS NULL THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501';
    END IF;
    effective_caller := p_caller_id;
  ELSE
    IF caller IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501'; END IF;
    IF p_caller_id IS DISTINCT FROM caller THEN
      RAISE EXCEPTION 'caller_mismatch' USING ERRCODE='42501';
    END IF;
    effective_caller := caller;
  END IF;

  IF p_type NOT IN ('direct','group','announcement') THEN
    RAISE EXCEPTION 'invalid_type' USING ERRCODE='22023';
  END IF;
  IF array_length(p_participant_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'empty_participants' USING ERRCODE='22023';
  END IF;
  IF NOT (effective_caller = ANY(p_participant_ids)) THEN
    RAISE EXCEPTION 'caller_not_in_participants' USING ERRCODE='22023';
  END IF;
  IF p_type = 'direct' AND array_length(p_participant_ids, 1) <> 2 THEN
    RAISE EXCEPTION 'direct_requires_two' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.messenger_conversations (type, title, avatar_url, created_by)
  VALUES (p_type, p_title, p_avatar, effective_caller)
  RETURNING id INTO new_conv_id;

  FOREACH uid IN ARRAY p_participant_ids LOOP
    INSERT INTO public.messenger_participants (conversation_id, user_id, role, last_read_at)
    VALUES (
      new_conv_id, uid,
      CASE WHEN p_type='direct' THEN 'member'
           WHEN uid=effective_caller THEN 'owner'
           ELSE 'member' END,
      CASE WHEN uid=effective_caller THEN now() ELSE NULL END
    )
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;

  RETURN new_conv_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_messenger_create_conversation(uuid, text, text, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_messenger_create_conversation(uuid, text, text, text, uuid[]) TO authenticated, service_role;

DROP POLICY IF EXISTS mlp_insert_authenticated ON public.messenger_link_previews;
