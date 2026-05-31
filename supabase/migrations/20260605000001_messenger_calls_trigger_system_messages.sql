-- ============================================================================
-- PepNationLab Messenger - Call history transactions inside chat
-- Automatically inserts system messages into messenger_messages on terminal
-- states of messenger_calls (ended, declined, missed).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_messenger_calls_after_update()
RETURNS trigger AS $$
DECLARE
  v_text text;
  v_duration interval;
BEGIN
  -- Only execute when call status transitions to a terminal state
  IF OLD.status = NEW.status OR NEW.status NOT IN ('ended', 'declined', 'missed') THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'declined' THEN
    v_text := 'Declined ' || NEW.call_type || ' call';
  ELSIF NEW.status = 'missed' OR (NEW.status = 'ended' AND NEW.answered_at IS NULL) THEN
    v_text := 'Missed ' || NEW.call_type || ' call';
  ELSIF NEW.status = 'ended' AND NEW.answered_at IS NOT NULL THEN
    v_duration := NEW.ended_at - NEW.answered_at;
    DECLARE
      v_seconds int := EXTRACT(EPOCH FROM v_duration)::int;
      v_m int := v_seconds / 60;
      v_s int := v_seconds % 60;
    BEGIN
      IF v_m > 0 THEN
        v_text := NEW.call_type || ' call ended — ' || v_m || 'm ' || v_s || 's';
      ELSE
        v_text := NEW.call_type || ' call ended — ' || v_s || 's';
      END IF;
    END;
  END IF;

  -- Insert call history transaction as a system message
  -- Note: We use NEW.initiator_id as the sender_id so that standard select policies permit it
  INSERT INTO public.messenger_messages (
    conversation_id,
    sender_id,
    message_type,
    text,
    created_at,
    updated_at
  ) VALUES (
    NEW.conversation_id,
    NEW.initiator_id,
    'system',
    v_text,
    COALESCE(NEW.ended_at, now()),
    COALESCE(NEW.ended_at, now())
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_messenger_calls_after_update ON public.messenger_calls;
CREATE TRIGGER trg_messenger_calls_after_update AFTER UPDATE OF status ON public.messenger_calls
FOR EACH ROW EXECUTE FUNCTION public.fn_messenger_calls_after_update();
