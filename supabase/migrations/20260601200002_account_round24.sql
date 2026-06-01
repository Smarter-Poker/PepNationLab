-- ============================================================================
-- Round 24 — Account Self-Serve Surface
-- ============================================================================
-- Adds the schema the Account page (Profile / Security / Notifications /
-- Compliance / Danger Zone) needs:
--   * Extra profile columns (phone, timezone, locale, bio, pronouns, etc.)
--   * user_sessions       — device session ledger for Security tab
--   * username_changes    — history of username edits, drives 30-day cooldown
--   * account_audit_log   — append-only audit trail of self-serve events
--   * account_export_jobs — queue of "download my data" requests
--   * log_account_event() — SECURITY DEFINER RPC, the only way to append to
--                           account_audit_log from app code
--
-- RLS pattern: every table is keyed by user_id and scoped to auth.uid().
-- Admins keep visibility via is_admin(). All policies are explicit.
-- ============================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone               TEXT,
  ADD COLUMN IF NOT EXISTS timezone            TEXT          DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS locale              TEXT          DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS bio                 TEXT,
  ADD COLUMN IF NOT EXISTS pronouns            TEXT,
  ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_at      TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.timezone IS
  'IANA timezone id used to render times in this user''s UI.';
COMMENT ON COLUMN public.profiles.username_changed_at IS
  'Last successful username change; drives the 30-day cooldown on the Profile tab.';
COMMENT ON COLUMN public.profiles.deactivated_at IS
  'When the user self-deactivated; combined with is_active=false to soft-suspend.';

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT,
  user_agent  TEXT,
  ip          INET,
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS user_sessions_user_active_idx
  ON public.user_sessions (user_id, revoked_at);

CREATE INDEX IF NOT EXISTS user_sessions_user_last_seen_idx
  ON public.user_sessions (user_id, last_seen DESC);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_sessions_self_select ON public.user_sessions;
CREATE POLICY user_sessions_self_select ON public.user_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS user_sessions_self_insert ON public.user_sessions;
CREATE POLICY user_sessions_self_insert ON public.user_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS user_sessions_self_update ON public.user_sessions;
CREATE POLICY user_sessions_self_update ON public.user_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE TABLE IF NOT EXISTS public.username_changes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_username  TEXT,
  new_username  TEXT NOT NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS username_changes_user_idx
  ON public.username_changes (user_id, changed_at DESC);

ALTER TABLE public.username_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS username_changes_self_select ON public.username_changes;
CREATE POLICY username_changes_self_select ON public.username_changes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS username_changes_self_insert ON public.username_changes;
CREATE POLICY username_changes_self_insert ON public.username_changes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE TABLE IF NOT EXISTS public.account_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  event       TEXT NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS account_audit_log_user_idx
  ON public.account_audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS account_audit_log_event_idx
  ON public.account_audit_log (event, created_at DESC);

ALTER TABLE public.account_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_audit_log_self_select ON public.account_audit_log;
CREATE POLICY account_audit_log_self_select ON public.account_audit_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE TABLE IF NOT EXISTS public.account_export_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'queued',
  file_path     TEXT,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  CHECK (status IN ('queued', 'running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS account_export_jobs_user_idx
  ON public.account_export_jobs (user_id, requested_at DESC);

ALTER TABLE public.account_export_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_export_jobs_self_select ON public.account_export_jobs;
CREATE POLICY account_export_jobs_self_select ON public.account_export_jobs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS account_export_jobs_self_insert ON public.account_export_jobs;
CREATE POLICY account_export_jobs_self_insert ON public.account_export_jobs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS account_export_jobs_admin_update ON public.account_export_jobs;
CREATE POLICY account_export_jobs_admin_update ON public.account_export_jobs
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.log_account_event(
  p_user_id UUID,
  p_event   TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_id     UUID;
BEGIN
  IF v_caller IS NOT NULL
     AND v_caller <> p_user_id
     AND NOT public.is_admin()
  THEN
    RAISE EXCEPTION 'forbidden_log_account_event'
      USING ERRCODE = '42501';
  END IF;

  IF p_event IS NULL OR length(btrim(p_event)) = 0 THEN
    RAISE EXCEPTION 'event_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.account_audit_log (user_id, event, details)
  VALUES (p_user_id, p_event, p_details)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_account_event(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_account_event(UUID, TEXT, JSONB)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.log_account_event(UUID, TEXT, JSONB) IS
  'Append-only writer for account_audit_log. Callers may only log events '
  'about themselves; admin/service role can log on behalf of any user.';

COMMIT;
