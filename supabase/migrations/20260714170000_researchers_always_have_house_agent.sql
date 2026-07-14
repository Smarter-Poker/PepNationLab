-- Structural rule (owner request 2026-07-14): the house store (admin's
-- Pep Nation Research Store, agent_profiles slug 'researchstore') is the
-- ASSIGNED agent for every researcher who has no referring agent. No
-- researcher row may ever sit orphaned: backfill any existing NULLs and
-- enforce at write time with a trigger, so signup paths, admin edits, and
-- future code can never produce an unassigned researcher again.
--
-- NOTE ON TRIGGER NAME: BEFORE triggers fire in alphabetical name order.
-- The existing guard trg_enforce_researcher_agent_binding RAISES on a NULL
-- referring_agent_id, so the fill trigger is named trg_00_... to sort (and
-- fire) first: an orphaned researcher is silently assigned to the house
-- store and the guard then passes instead of erroring. The guard's
-- change-once-set rule still applies -- an already-bound researcher cannot
-- be reassigned or detached.

UPDATE public.profiles
   SET referring_agent_id = (
     SELECT id FROM public.agent_profiles
      WHERE slug = 'researchstore' AND is_active = true
      LIMIT 1
   )
 WHERE role = 'researcher'
   AND referring_agent_id IS NULL;

CREATE OR REPLACE FUNCTION public.ensure_researcher_house_agent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.role = 'researcher' AND NEW.referring_agent_id IS NULL THEN
    SELECT id INTO NEW.referring_agent_id
      FROM public.agent_profiles
     WHERE slug = 'researchstore' AND is_active = true
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_researcher_house_agent ON public.profiles;
DROP TRIGGER IF EXISTS trg_00_ensure_researcher_house_agent ON public.profiles;
CREATE TRIGGER trg_00_ensure_researcher_house_agent
  BEFORE INSERT OR UPDATE OF role, referring_agent_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_researcher_house_agent();
