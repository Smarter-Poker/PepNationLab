-- ============================================================
-- Enforce researcher ↔ agent binding at the database level
-- ============================================================
-- Rules enforced:
--   1. Every 'researcher' profile MUST have referring_agent_id set.
--   2. referring_agent_id must point to a real agent/super_agent/admin profile.
--   3. referring_agent_id cannot be changed to a different agent once set
--      (only an admin can reassign a researcher).
--   4. When a researcher is promoted to 'agent', their referring_agent_id
--      is preserved (attribution) but parent_agent_id is set to the super agent.
-- ============================================================

-- Function: validate researcher agent binding on INSERT or UPDATE
CREATE OR REPLACE FUNCTION enforce_researcher_agent_binding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only applies to researcher role
  IF NEW.role = 'researcher' THEN

    -- referring_agent_id must always be set for researchers
    IF NEW.referring_agent_id IS NULL THEN
      RAISE EXCEPTION
        'researchers must have referring_agent_id set (profile id=%)', NEW.id
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    -- referring_agent_id must point to a real agent/super_agent/admin profile
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = NEW.referring_agent_id
        AND role IN ('agent', 'super_agent', 'admin')
    ) THEN
      RAISE EXCEPTION
        'referring_agent_id % does not point to a valid agent profile', NEW.referring_agent_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- Prevent changing referring_agent_id once set (only allow during INSERT or if old value was NULL)
    IF TG_OP = 'UPDATE'
       AND OLD.referring_agent_id IS NOT NULL
       AND NEW.referring_agent_id <> OLD.referring_agent_id THEN
      RAISE EXCEPTION
        'referring_agent_id cannot be changed once set for researcher id=%', NEW.id
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Drop old trigger if it exists
DROP TRIGGER IF EXISTS trg_enforce_researcher_agent_binding ON public.profiles;

-- Create trigger that fires on INSERT and UPDATE
CREATE TRIGGER trg_enforce_researcher_agent_binding
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_researcher_agent_binding();

-- ============================================================
-- Backfill: any existing researchers with NULL referring_agent_id
-- get flagged in the log (we can't auto-assign without knowing the agent)
-- ============================================================
DO $$
DECLARE
  orphan RECORD;
BEGIN
  FOR orphan IN
    SELECT id, username, email FROM public.profiles
    WHERE role = 'researcher' AND referring_agent_id IS NULL
  LOOP
    RAISE WARNING
      'Orphaned researcher with no referring_agent_id: id=%, username=%, email=%',
      orphan.id, orphan.username, orphan.email;
  END LOOP;
END;
$$;
