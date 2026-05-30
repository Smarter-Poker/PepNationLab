-- Audit Pass 8: harden RLS UPDATE WITH CHECK clauses.
--
-- Before: messenger_messages / messenger_conversations / messenger_participants
-- UPDATE policies had USING but NO WITH CHECK. This means the post-image of
-- the row is not validated, so a sender could (in theory) re-assign
-- sender_id, conversation_id, etc. The service-role client used by all
-- our routes bypasses RLS anyway, but defense in depth says WITH CHECK
-- should match USING.
--
-- Also: messenger_link_previews allowed any authenticated user to UPDATE
-- any cache row (USING true, no CHECK). Tighten by removing the public
-- UPDATE policy entirely -- only the service-role client maintains the
-- cache, anon/authenticated has no business writing to it.

-- 1) messenger_messages: lock sender_id and conversation_id to caller + their conversation.
DROP POLICY IF EXISTS mm_update_self ON public.messenger_messages;
CREATE POLICY mm_update_self ON public.messenger_messages
  FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messenger_participants p
      WHERE p.conversation_id = messenger_messages.conversation_id
        AND p.user_id = auth.uid()
    )
  );

-- 2) messenger_conversations: only owner/admin participants can update;
--    they must remain owner/admin afterwards.
DROP POLICY IF EXISTS mc_update_admins ON public.messenger_conversations;
CREATE POLICY mc_update_admins ON public.messenger_conversations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.messenger_participants p
      WHERE p.conversation_id = messenger_conversations.id
        AND p.user_id = auth.uid()
        AND p.role = ANY (ARRAY['owner','admin'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messenger_participants p
      WHERE p.conversation_id = messenger_conversations.id
        AND p.user_id = auth.uid()
        AND p.role = ANY (ARRAY['owner','admin'])
    )
  );

-- 3) messenger_participants: caller can only update their own row, and the
--    row must remain theirs (no reassigning user_id).
DROP POLICY IF EXISTS mp_update_self ON public.messenger_participants;
CREATE POLICY mp_update_self ON public.messenger_participants
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4) messenger_link_previews: cache is server-managed only. Remove the
--    authenticated UPDATE policy. Read remains open (it's a shared cache).
--    INSERT remains because the link-preview route uses upsert (insert on miss),
--    and the route runs under service-role anyway.
DROP POLICY IF EXISTS mlp_update_authenticated ON public.messenger_link_previews;
