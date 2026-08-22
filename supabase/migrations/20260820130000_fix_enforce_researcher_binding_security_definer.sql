-- Bug fix 2026-08-20: enforce_researcher_agent_binding lost its SECURITY DEFINER
-- when it was rewritten in 20260708061000_admin_reassign_researcher_rpc.sql.
--
-- Without SECURITY DEFINER the trigger runs as the calling user (e.g. a
-- researcher with `role = 'authenticated'`). Its inner SELECT:
--
--   SELECT 1 FROM public.profiles
--   WHERE id = NEW.referring_agent_id AND role IN ('agent', 'super_agent', 'admin')
--
-- is then subject to RLS. A researcher's RLS SELECT policy only lets them see
-- their OWN profile row ("Users can view own profile"). Their referring agent's
-- row is invisible → EXISTS() returns false → the trigger raises:
--
--   "referring_agent_id does not point to a valid agent profile"
--
-- even though the FK is perfectly valid. This breaks any researcher trying to
-- PATCH their own profile (first_name / last_name / phone from checkout).
--
-- Fix: restore SECURITY DEFINER so the existence check always bypasses RLS,
-- preserving the full logic added in 20260708061000.

CREATE OR REPLACE FUNCTION public.enforce_researcher_agent_binding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER                         -- ← the missing declaration
SET search_path = public
AS $$
BEGIN
  -- Only applies to researcher role
  IF NEW.role = 'researcher' THEN

    -- referring_agent_id must always be set for researchers
    IF NEW.referring_agent_id IS NULL THEN
      -- Allow NULL on INSERT to support the handle_new_user trigger which
      -- creates auth users without knowing their referring agent.
      -- We will enforce this on the subsequent UPDATE (upsert).
      IF TG_OP = 'INSERT' THEN
        -- Allow it temporarily
      ELSE
        RAISE EXCEPTION
          'researchers must have referring_agent_id set (profile id=%)', NEW.id
          USING ERRCODE = 'integrity_constraint_violation';
      END IF;
    ELSE
      -- referring_agent_id must point to a real agent/super_agent/admin profile.
      -- SECURITY DEFINER ensures this SELECT bypasses RLS so the agent row is
      -- visible regardless of who triggered the update.
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = NEW.referring_agent_id
          AND role IN ('agent', 'super_agent', 'admin')
      ) THEN
        RAISE EXCEPTION
          'referring_agent_id % does not point to a valid agent profile', NEW.referring_agent_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;
    END IF;

    -- Prevent changing referring_agent_id once set (only allow during INSERT,
    -- if the old value was NULL, or through the sanctioned admin reassignment
    -- RPC which sets the transaction-local flag below).
    IF TG_OP = 'UPDATE'
       AND OLD.referring_agent_id IS NOT NULL
       AND NEW.referring_agent_id IS NOT NULL
       AND NEW.referring_agent_id <> OLD.referring_agent_id
       AND COALESCE(current_setting('app.allow_researcher_reassign', true), '') <> 'on' THEN
      RAISE EXCEPTION
        'referring_agent_id cannot be changed once set for researcher id=%', NEW.id
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;
