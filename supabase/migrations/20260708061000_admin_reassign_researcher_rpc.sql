-- Admin researcher reassignment was completely broken: the
-- enforce_researcher_agent_binding trigger forbids ANY change to
-- referring_agent_id once set, which also blocked the sanctioned
-- admin "Assign Researcher To An Agent" feature (it failed with
-- "An Unexpected Error Occurred").
--
-- Fix: keep the anti-poaching immutability rule for all ordinary writes,
-- but let a transaction-local flag (settable only inside the SECURITY
-- DEFINER RPC below) bypass it. The RPC is executable by service_role
-- only, and the API route calling it is admin-gated.
-- Applied to production (ydsaqnnuwyvtyxgvrnys) on 2026-07-08 via MCP as
-- migration admin_reassign_researcher_rpc.

CREATE OR REPLACE FUNCTION enforce_researcher_agent_binding()
RETURNS trigger
LANGUAGE plpgsql
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

-- Sanctioned admin reassignment path. SECURITY DEFINER + service_role-only
-- execute; the calling API route (POST /api/admin/researchers,
-- action=assign_researcher) is gated by requireAdmin().
CREATE OR REPLACE FUNCTION admin_reassign_researcher(
  p_researcher_id uuid,
  p_new_referring_agent_id uuid,
  p_new_parent_agent_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Transaction-local: automatically reverts when this call ends.
  PERFORM set_config('app.allow_researcher_reassign', 'on', true);

  UPDATE profiles
  SET referring_agent_id = p_new_referring_agent_id,
      parent_agent_id = p_new_parent_agent_id,
      referring_sub_agent_id = NULL,
      updated_at = now()
  WHERE id = p_researcher_id
    AND role = 'researcher';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'researcher % not found or not a researcher', p_researcher_id
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION admin_reassign_researcher(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_reassign_researcher(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION admin_reassign_researcher(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION admin_reassign_researcher(uuid, uuid, uuid) TO service_role;
