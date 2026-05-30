-- audit14: fn_get_user_conversations was raising 42702 (ambiguous column)
-- because the LATERAL subquery's WHERE clause referenced unqualified
-- `conversation_id` -- which Postgres could resolve to either the column on
-- messenger_participants OR the RETURNS TABLE output variable of the outer
-- function. Symptom in production: POST /api/messenger/get-conversations
-- returns 500 on every call.
--
-- Fix: alias the inner table (`mp`) and qualify the column reference
-- explicitly. No change to the function's return shape or security model.

CREATE OR REPLACE FUNCTION public.fn_get_user_conversations(p_user uuid)
 RETURNS TABLE(conversation_id uuid, type text, title text, avatar_url text, last_message_text text, last_message_at timestamp with time zone, unread_count integer, is_pinned boolean, is_muted boolean, counterparty_id uuid, counterparty_full_name text, counterparty_username text, counterparty_role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT mp.user_id
    FROM public.messenger_participants mp
    WHERE mp.conversation_id = c.id
      AND mp.user_id <> p_user
      AND c.type = 'direct'
    LIMIT 1
  ) cp ON true
  LEFT JOIN public.profiles cprofile ON cprofile.id = cp.user_id
  WHERE p.user_id = p_user
    AND c.is_archived = false
    AND COALESCE((p.settings ->> 'archived')::boolean, false) = false
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT 200;
END;
$function$;
