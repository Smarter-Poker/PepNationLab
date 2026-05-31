-- B2: When a block is inserted, immediately terminate any ringing or active
-- call in a conversation that includes both blocker and blocked. The status
-- flip to 'ended' fires the existing postgres_changes UPDATE handler which
-- tears down both sides' overlays via call_ended UI path.

CREATE OR REPLACE FUNCTION public.fn_terminate_calls_on_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messenger_calls AS c
  SET status = 'ended',
      ended_at = COALESCE(c.ended_at, now())
  WHERE c.status IN ('ringing', 'active')
    AND EXISTS (
      SELECT 1 FROM public.messenger_participants p1
      WHERE p1.conversation_id = c.conversation_id
        AND p1.user_id = NEW.blocker_id
    )
    AND EXISTS (
      SELECT 1 FROM public.messenger_participants p2
      WHERE p2.conversation_id = c.conversation_id
        AND p2.user_id = NEW.blocked_id
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_terminate_calls_on_block ON public.messenger_blocked;
CREATE TRIGGER trg_terminate_calls_on_block
AFTER INSERT ON public.messenger_blocked
FOR EACH ROW EXECUTE FUNCTION public.fn_terminate_calls_on_block();
