-- B8: Realtime Authorization policies for call-signal private channels.
-- Public channels remain unaffected; only channels created with
-- `config: { private: true }` are gated by these policies.

CREATE OR REPLACE FUNCTION public.fn_call_signal_topic_user(p_topic text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uuid_text text;
  v_uuid uuid;
BEGIN
  IF p_topic IS NULL OR p_topic NOT LIKE 'call-signal:%' THEN
    RETURN NULL;
  END IF;
  v_uuid_text := substring(p_topic from 13);
  BEGIN
    v_uuid := v_uuid_text::uuid;
    RETURN v_uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_call_signal_topic_user(text) TO authenticated, anon, service_role;

DROP POLICY IF EXISTS messenger_call_signal_select ON realtime.messages;
CREATE POLICY messenger_call_signal_select
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'call-signal:%' AND
  public.fn_call_signal_topic_user(realtime.topic()) = (SELECT auth.uid())
);

DROP POLICY IF EXISTS messenger_call_signal_insert ON realtime.messages;
CREATE POLICY messenger_call_signal_insert
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'call-signal:%' AND
  public.fn_call_signal_topic_user(realtime.topic()) IS NOT NULL AND
  EXISTS (
    SELECT 1
    FROM public.messenger_participants p_self
    JOIN public.messenger_participants p_target
      ON p_target.conversation_id = p_self.conversation_id
    WHERE p_self.user_id = (SELECT auth.uid())
      AND p_target.user_id = public.fn_call_signal_topic_user(realtime.topic())
      AND p_self.user_id <> p_target.user_id
  )
);
