-- =============================================================================
-- oauth_link_fresh_referral: sanctioned referral upgrade for BRAND-NEW OAuth
-- signups.
--
-- Why: trg_00_ensure_researcher_house_agent house-links every researcher row
-- the moment handle_new_user creates it, and enforce_researcher_agent_binding
-- forbids changing a non-null referral through a plain UPDATE. Together they
-- made the /signup agentRef capture a no-op for Google signups - the OAuth
-- callback arrived to find the referral already "set" (to the house
-- placeholder) and could never apply the agent the user actually chose or
-- scanned.
--
-- This RPC is the narrow, DB-enforced exception: it flips the referral ONLY
-- when ALL of the following hold (checked here, not in app code, so no app
-- bug can widen it):
--   * the target row is a researcher
--   * its current referral is exactly the house placeholder (researchstore)
--   * the profile was created within the last 15 minutes (a fresh signup
--     mid-OAuth-round-trip, not an established house researcher)
--   * the new agent is a real, ACTIVE agent/super_agent/admin account
-- Established referrals - house links older than 15 minutes and ALL named
-- agent links - remain immutable except via admin_reassign_researcher.
--
-- Returns true when exactly one row was upgraded, false otherwise (callers
-- treat false as "keep the house link" and never block the signup).
-- =============================================================================

CREATE OR REPLACE FUNCTION oauth_link_fresh_referral(
  p_user_id uuid,
  p_agent_id uuid,
  p_sub_agent_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  -- Transaction-local sanction flag for enforce_researcher_agent_binding;
  -- automatically reverts when this call ends.
  PERFORM set_config('app.allow_researcher_reassign', 'on', true);

  UPDATE profiles
     SET referring_agent_id = p_agent_id,
         referring_sub_agent_id = COALESCE(p_sub_agent_id, referring_sub_agent_id),
         updated_at = now()
   WHERE id = p_user_id
     AND role = 'researcher'
     AND created_at > now() - interval '15 minutes'
     AND referring_agent_id = (
       SELECT id FROM agent_profiles WHERE slug = 'researchstore' LIMIT 1
     )
     AND p_agent_id IN (
       SELECT id FROM profiles
        WHERE role IN ('agent', 'super_agent', 'admin')
          AND is_active = true
     );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION oauth_link_fresh_referral(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION oauth_link_fresh_referral(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION oauth_link_fresh_referral(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION oauth_link_fresh_referral(uuid, uuid, uuid) TO service_role;
