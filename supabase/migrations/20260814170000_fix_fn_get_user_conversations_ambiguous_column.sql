-- Fix: fn_get_user_conversations 42702 ambiguous column
--
-- Migration 20260812230000 re-introduced the ambiguous-column bug that was
-- fixed in 20260530000016. Inside the LATERAL subquery, `conversation_id`
-- is ambiguous between messenger_participants (aliased here as p2) and the
-- outer messenger_conversations join (alias c). PostgreSQL raises:
--   column reference "conversation_id" is ambiguous (42702)
--
-- Fix: alias the inner messenger_participants as p2 and qualify every
-- column reference inside the LATERAL.

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
  counterparty_role TEXT,
  counterparty_avatar_url TEXT
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
    c.id                          AS conversation_id,
    c.type::TEXT,
    c.title,
    c.avatar_url,
    c.last_message_text,
    c.last_message_at,
    p.unread_count,
    p.is_pinned,
    p.is_muted,
    cp.user_id                    AS counterparty_id,
    cprofile.full_name            AS counterparty_full_name,
    cprofile.username             AS counterparty_username,
    cprofile.role::TEXT           AS counterparty_role,
    cprofile.avatar_url           AS counterparty_avatar_url
  FROM public.messenger_participants p
  JOIN public.messenger_conversations c ON c.id = p.conversation_id
  LEFT JOIN LATERAL (
    -- Alias inner participants as p2 to avoid the ambiguous `conversation_id`
    -- reference that caused 42702 when the outer alias c was also in scope.
    SELECT p2.user_id
      FROM public.messenger_participants p2
     WHERE p2.conversation_id = c.id
       AND p2.user_id <> p_user
       AND c.type = 'direct'
     LIMIT 1
  ) cp ON true
  LEFT JOIN public.profiles cprofile ON cprofile.id = cp.user_id
  WHERE p.user_id = p_user
    AND c.is_archived = false
    AND COALESCE((p.settings->>'archived')::boolean, false) = false
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT 200;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_get_user_conversations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_user_conversations(uuid) TO authenticated, service_role;
