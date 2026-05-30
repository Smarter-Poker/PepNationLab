-- audit14: send-message returned 403 every call because the underlying
-- getParticipant lookup ran under the user JWT (createServiceClient leaks
-- cookies through @supabase/ssr) and silently swallowed errors. Move the
-- lookup behind a SECURITY DEFINER RPC so RLS cannot break it.

CREATE OR REPLACE FUNCTION public.fn_messenger_get_participant(
  p_conv_id uuid,
  p_user_id uuid
)
RETURNS TABLE(id uuid, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT mp.id, mp.role
  FROM public.messenger_participants mp
  WHERE mp.conversation_id = p_conv_id
    AND mp.user_id = p_user_id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_messenger_get_participant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_messenger_get_participant(uuid, uuid) TO authenticated, service_role;
