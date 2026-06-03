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
    END IF;

    -- Prevent changing referring_agent_id once set (only allow during INSERT or if old value was NULL)
    IF TG_OP = 'UPDATE'
       AND OLD.referring_agent_id IS NOT NULL
       AND NEW.referring_agent_id IS NOT NULL
       AND NEW.referring_agent_id <> OLD.referring_agent_id THEN
      RAISE EXCEPTION
        'referring_agent_id cannot be changed once set for researcher id=%', NEW.id
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;
