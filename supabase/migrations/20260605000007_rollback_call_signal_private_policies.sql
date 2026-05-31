-- HOTFIX fix-38: roll back the B8 realtime.messages policies for
-- call-signal:<userId> private channels. The combination of these
-- policies + `private: true` client/server flags + GlobalCallListener
-- resume-on-mount produced a render-time crash that blocked the
-- whole app for any user with an in-flight call row.

DROP POLICY IF EXISTS messenger_call_signal_select ON realtime.messages;
DROP POLICY IF EXISTS messenger_call_signal_insert ON realtime.messages;
DROP FUNCTION IF EXISTS public.fn_call_signal_topic_user(text);
