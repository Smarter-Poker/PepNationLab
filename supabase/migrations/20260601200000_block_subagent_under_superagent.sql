-- PLATFORM RULE (2026-06-01): Super-agents may only create researcher or full
-- agent accounts. They can NEVER own a sub-agent. This trigger is the hard
-- backstop enforcing that invariant regardless of which code path runs.
CREATE OR REPLACE FUNCTION public.block_subagent_under_superagent()
RETURNS TRIGGER AS $$
DECLARE
  parent_is_super boolean;
BEGIN
  IF NEW.is_sub_agent IS TRUE AND NEW.parent_agent_id IS NOT NULL THEN
    SELECT is_super_agent INTO parent_is_super
    FROM public.profiles
    WHERE id = NEW.parent_agent_id;

    IF parent_is_super IS TRUE THEN
      RAISE EXCEPTION 'Super-agents cannot own sub-agents. A super-agent may only create researcher or full agent accounts.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_block_subagent_under_superagent ON public.profiles;
CREATE TRIGGER trg_block_subagent_under_superagent
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.block_subagent_under_superagent();
