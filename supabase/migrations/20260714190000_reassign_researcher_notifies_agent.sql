-- Reassigning a researcher must notify the receiving agent (in-app row +
-- web push via the push-dispatch cron, respecting notification preferences).
-- Done inside the sanctioned RPC so EVERY caller gets it.
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
DECLARE
  v_name text;
  v_push_enabled boolean;
  v_mute_all boolean;
  v_type_prefs jsonb;
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

  -- Notify the receiving agent that a researcher joined their downline.
  IF p_new_referring_agent_id IS NOT NULL AND p_new_referring_agent_id <> p_researcher_id THEN
    SELECT coalesce(nullif(btrim(full_name), ''), username, 'A Researcher')
      INTO v_name FROM profiles WHERE id = p_researcher_id;

    INSERT INTO notifications (user_id, type, title, body, url)
    VALUES (
      p_new_referring_agent_id,
      'new_researcher',
      'New Researcher: ' || v_name,
      v_name || ' was added to your team.',
      '/dashboard/agent?tab=researchers'
    );

    -- Queue a web push when the recipient's preferences allow it (absent
    -- push_type_prefs key = enabled; delivered by /api/cron/push-dispatch).
    SELECT push_enabled, mute_all, push_type_prefs
      INTO v_push_enabled, v_mute_all, v_type_prefs
      FROM notification_preferences WHERE user_id = p_new_referring_agent_id;

    IF FOUND AND coalesce(v_push_enabled, false) AND NOT coalesce(v_mute_all, false)
       AND coalesce((v_type_prefs->>'new_researcher')::boolean, true) THEN
      INSERT INTO push_outbox (recipient_user_id, title, body, url, tag, status)
      VALUES (
        p_new_referring_agent_id,
        'New Researcher: ' || v_name,
        v_name || ' was added to your team.',
        '/dashboard/agent?tab=researchers',
        'new_researcher',
        'pending'
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION admin_reassign_researcher(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_reassign_researcher(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION admin_reassign_researcher(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION admin_reassign_researcher(uuid, uuid, uuid) TO service_role;
