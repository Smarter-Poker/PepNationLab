-- Invoice v2 sweep 4 — freeze_account / unfreeze_account walked the
-- parent_agent_id chain with `WHILE v_walker IS NOT NULL` and no depth cap.
-- profiles.parent_agent_id is an FK but has no cycle-prevention CHECK, so a
-- malformed cycle (A.parent=B AND B.parent=A — manual DB edit or future bug
-- in a promote/demote path) would loop forever inside the RPC and hang the
-- Postgres backend connection.
--
-- walk_billing_chain already caps at level 5 via a recursive CTE; bring
-- freeze + unfreeze to parity with a hard depth limit. 10 is generous —
-- the platform's intended hierarchy is admin → super_agent → agent →
-- sub_agent (3 levels), so 10 is double the headroom and clearly an
-- error path if we ever hit it.

CREATE OR REPLACE FUNCTION public.freeze_account(p_target_id uuid, p_reason text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_authorized boolean := false;
  v_walker uuid;
  v_depth integer := 0;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role::text INTO v_caller_role FROM profiles WHERE id = v_caller;
  IF v_caller_role = 'admin' THEN
    v_authorized := true;
  ELSE
    -- Caller must be a transitive ancestor of the target. Hard depth cap
    -- guards against parent_agent_id cycles.
    v_walker := (SELECT parent_agent_id FROM profiles WHERE id = p_target_id);
    WHILE v_walker IS NOT NULL AND v_depth < 10 LOOP
      IF v_walker = v_caller THEN v_authorized := true; EXIT; END IF;
      v_walker := (SELECT parent_agent_id FROM profiles WHERE id = v_walker);
      v_depth := v_depth + 1;
    END LOOP;
  END IF;
  IF NOT v_authorized THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE profiles
    SET is_transactions_frozen = true,
        frozen_at = now(),
        frozen_by = v_caller,
        frozen_reason = NULLIF(trim(p_reason), '')
  WHERE id = p_target_id;

  INSERT INTO admin_audit_log(actor_id, action, target_id, target_type, notes)
    VALUES (v_caller, 'freeze_account', p_target_id, 'profile', p_reason);

  RETURN jsonb_build_object('ok', true, 'target', p_target_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.unfreeze_account(p_target_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_authorized boolean := false;
  v_walker uuid;
  v_depth integer := 0;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role::text INTO v_caller_role FROM profiles WHERE id = v_caller;
  IF v_caller_role = 'admin' THEN
    v_authorized := true;
  ELSE
    v_walker := (SELECT parent_agent_id FROM profiles WHERE id = p_target_id);
    WHILE v_walker IS NOT NULL AND v_depth < 10 LOOP
      IF v_walker = v_caller THEN v_authorized := true; EXIT; END IF;
      v_walker := (SELECT parent_agent_id FROM profiles WHERE id = v_walker);
      v_depth := v_depth + 1;
    END LOOP;
  END IF;
  IF NOT v_authorized THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE profiles
    SET is_transactions_frozen = false,
        frozen_at = NULL,
        frozen_by = NULL,
        frozen_reason = NULL
  WHERE id = p_target_id;

  INSERT INTO admin_audit_log(actor_id, action, target_id, target_type, notes)
    VALUES (v_caller, 'unfreeze_account', p_target_id, 'profile', NULL);

  RETURN jsonb_build_object('ok', true, 'target', p_target_id);
END;
$function$;

-- Self-assertion — confirm the new bodies contain the depth cap.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'freeze_account'
      AND pg_get_functiondef(p.oid) LIKE '%v_depth < 10%'
  ) THEN
    RAISE EXCEPTION 'freeze_account depth cap missing after migration';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'unfreeze_account'
      AND pg_get_functiondef(p.oid) LIKE '%v_depth < 10%'
  ) THEN
    RAISE EXCEPTION 'unfreeze_account depth cap missing after migration';
  END IF;
END $$;
