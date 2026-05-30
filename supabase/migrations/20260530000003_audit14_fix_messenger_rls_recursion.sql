-- audit14: every messenger send/list call returned 42P17 ("infinite recursion
-- detected in policy for relation messenger_participants"). Root cause: the
-- SELECT policy on messenger_participants does an EXISTS subquery against
-- messenger_participants itself, which re-triggers the same policy. Six other
-- policies on messenger_conversations / messenger_messages / messenger_reactions
-- chained through it and inherited the same recursion.
--
-- Fix: use SECURITY DEFINER helper functions (which bypass RLS) for any policy
-- that needs to test participation. Same pattern already used in
-- 20260528000013_fix_rls_recursion.sql and 20260528000014_fix_super_agent_recursion.sql.

CREATE OR REPLACE FUNCTION public.fn_messenger_is_participant(
  p_conv_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messenger_participants
    WHERE conversation_id = p_conv_id
      AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_messenger_is_admin_or_owner(
  p_conv_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messenger_participants
    WHERE conversation_id = p_conv_id
      AND user_id = p_user_id
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_is_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND role = 'admin'::user_role
  );
$$;

REVOKE ALL ON FUNCTION public.fn_messenger_is_participant(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_messenger_is_admin_or_owner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_is_platform_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_messenger_is_participant(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_messenger_is_admin_or_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_is_platform_admin(uuid) TO authenticated, service_role;

-- messenger_participants -----------------------------------------------------
DROP POLICY IF EXISTS mp_select_own_conv ON public.messenger_participants;
DROP POLICY IF EXISTS mp_delete_self_or_admin ON public.messenger_participants;
DROP POLICY IF EXISTS mp_insert_admin ON public.messenger_participants;
DROP POLICY IF EXISTS mp_update_self ON public.messenger_participants;

CREATE POLICY mp_select_own_conv ON public.messenger_participants
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.fn_messenger_is_participant(conversation_id, auth.uid())
  );

CREATE POLICY mp_insert_self_or_admin ON public.messenger_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.fn_messenger_is_admin_or_owner(conversation_id, auth.uid())
  );

CREATE POLICY mp_update_self ON public.messenger_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY mp_delete_self_or_admin ON public.messenger_participants
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.fn_messenger_is_admin_or_owner(conversation_id, auth.uid())
  );

-- messenger_conversations ----------------------------------------------------
DROP POLICY IF EXISTS mc_select_participants ON public.messenger_conversations;
DROP POLICY IF EXISTS mc_update_admins ON public.messenger_conversations;

CREATE POLICY mc_select_participants ON public.messenger_conversations
  FOR SELECT TO authenticated
  USING (
    public.fn_messenger_is_participant(id, auth.uid())
    OR public.fn_is_platform_admin(auth.uid())
  );

CREATE POLICY mc_update_admins ON public.messenger_conversations
  FOR UPDATE TO authenticated
  USING (public.fn_messenger_is_admin_or_owner(id, auth.uid()))
  WITH CHECK (public.fn_messenger_is_admin_or_owner(id, auth.uid()));

-- messenger_messages ---------------------------------------------------------
DROP POLICY IF EXISTS mm_insert_self_in_conv ON public.messenger_messages;
DROP POLICY IF EXISTS mm_select_participants ON public.messenger_messages;
DROP POLICY IF EXISTS mm_update_self ON public.messenger_messages;

CREATE POLICY mm_insert_self_in_conv ON public.messenger_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.fn_messenger_is_participant(conversation_id, auth.uid())
  );

CREATE POLICY mm_select_participants ON public.messenger_messages
  FOR SELECT TO authenticated
  USING (public.fn_messenger_is_participant(conversation_id, auth.uid()));

CREATE POLICY mm_update_self ON public.messenger_messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (
    sender_id = auth.uid()
    AND public.fn_messenger_is_participant(conversation_id, auth.uid())
  );

-- messenger_reactions --------------------------------------------------------
DROP POLICY IF EXISTS mr_select_participants ON public.messenger_reactions;

CREATE POLICY mr_select_participants ON public.messenger_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messenger_messages m
      WHERE m.id = messenger_reactions.message_id
        AND public.fn_messenger_is_participant(m.conversation_id, auth.uid())
    )
  );
