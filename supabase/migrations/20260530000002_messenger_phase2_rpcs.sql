-- ============================================================================
-- PepNationLab Messenger Phase 2 RPCs
-- fn_find_direct_conversation: dedupe direct conversations between two users.
-- fn_get_user_conversations:   return the caller's conversation list with
--                              per-participant unread/pin/mute state.
-- Both are SECURITY DEFINER with search_path locked to public. They are
-- callable by authenticated and service_role roles only.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_find_direct_conversation(a uuid, b uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
    FROM public.messenger_conversations c
   WHERE c.type = 'direct'
     AND (SELECT count(*) FROM public.messenger_participants p WHERE p.conversation_id = c.id) = 2
     AND EXISTS (SELECT 1 FROM public.messenger_participants p WHERE p.conversation_id = c.id AND p.user_id = a)
     AND EXISTS (SELECT 1 FROM public.messenger_participants p WHERE p.conversation_id = c.id AND p.user_id = b)
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_get_user_conversations(p_user uuid)
RETURNS TABLE (
  conversation_id uuid,
  type text,
  title text,
  avatar_url text,
  last_message_text text,
  last_message_at timestamptz,
  unread_count int,
  is_pinned boolean,
  is_muted boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id,
         c.type,
         c.title,
         c.avatar_url,
         c.last_message_text,
         c.last_message_at,
         p.unread_count,
         p.is_pinned,
         p.is_muted
    FROM public.messenger_conversations c
    JOIN public.messenger_participants p ON p.conversation_id = c.id
   WHERE p.user_id = p_user
     AND c.is_archived = false
   ORDER BY p.is_pinned DESC, c.last_message_at DESC NULLS LAST
   LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.fn_find_direct_conversation(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.fn_get_user_conversations(uuid) FROM public;

GRANT EXECUTE ON FUNCTION public.fn_find_direct_conversation(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_user_conversations(uuid) TO authenticated, service_role;
