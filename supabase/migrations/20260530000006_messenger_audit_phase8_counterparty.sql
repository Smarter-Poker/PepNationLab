-- ============================================================================
-- Messenger audit fix (2026-05-29) -- extend fn_get_user_conversations to
-- return the counterparty profile (id, full_name, username, role) for
-- direct conversations so the UI can render the OTHER participant's name
-- instead of falling back to the generic "Direct Message" placeholder.
-- Group/announcement rows return NULLs for those fields. profiles has no
-- avatar_url column today; counterparty_avatar_url is intentionally not
-- emitted -- ConversationItem renders initials via the existing Avatar.
-- Function return type changed, so we DROP+CREATE.
-- ============================================================================

DROP FUNCTION IF EXISTS public.fn_get_user_conversations(uuid);

CREATE FUNCTION public.fn_get_user_conversations(p_user uuid)
RETURNS TABLE (
  conversation_id uuid,
  type text,
  title text,
  avatar_url text,
  last_message_text text,
  last_message_at timestamptz,
  unread_count int,
  is_pinned boolean,
  is_muted boolean,
  counterparty_id uuid,
  counterparty_full_name text,
  counterparty_username text,
  counterparty_role text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT c.id AS conversation_id,
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
  ),
  cp AS (
    SELECT b.conversation_id,
           op.user_id AS counterparty_id,
           pr.full_name AS counterparty_full_name,
           pr.username AS counterparty_username,
           pr.role::text AS counterparty_role
      FROM base b
      JOIN public.messenger_participants op
        ON op.conversation_id = b.conversation_id AND op.user_id <> p_user
      LEFT JOIN public.profiles pr ON pr.id = op.user_id
     WHERE b.type = 'direct'
  )
  SELECT b.conversation_id,
         b.type,
         b.title,
         b.avatar_url,
         b.last_message_text,
         b.last_message_at,
         b.unread_count,
         b.is_pinned,
         b.is_muted,
         cp.counterparty_id,
         cp.counterparty_full_name,
         cp.counterparty_username,
         cp.counterparty_role
    FROM base b
    LEFT JOIN cp ON cp.conversation_id = b.conversation_id
   ORDER BY b.is_pinned DESC, b.last_message_at DESC NULLS LAST
   LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.fn_get_user_conversations(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_get_user_conversations(uuid) TO authenticated, service_role;
