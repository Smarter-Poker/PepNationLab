-- =============================================================================
-- AUTH LIFECYCLE EVENTS (SENTINEL Analytics Audit -- gap closure)
--
-- login, logout, failed login, and password reset/change had no event stream
-- (only per-user aggregates on profiles). This adds a privacy-minimal sink:
-- no raw usernames/emails and no raw IP -- failed-login identifiers and IPs are
-- salted-hashed so brute-force velocity can be analyzed without storing PII.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.auth_events (
  id              BIGSERIAL PRIMARY KEY,
  event_type      TEXT NOT NULL CHECK (event_type IN (
    'login','logout','login_failed',
    'password_reset_requested','password_reset_completed','password_changed'
  )),
  user_id         UUID,               -- set for authenticated events; null for failed logins
  identifier_hash TEXT,               -- salted hash of the attempted username/email (failed logins)
  ip_hash         TEXT,               -- salted hash of client IP (velocity analysis without PII)
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_type_time
  ON public.auth_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_user
  ON public.auth_events(user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_events_admin_select ON public.auth_events;
CREATE POLICY auth_events_admin_select ON public.auth_events
  FOR SELECT TO authenticated
  USING (public.is_admin());
-- No insert policies: writes go through the service-role sink only.

-- Extend the retention purge with auth_events (180 days). Full body kept in sync
-- with 20260711310000_research_events.sql.
CREATE OR REPLACE FUNCTION public.purge_analytics_data()
RETURNS TABLE (purged_table TEXT, deleted_rows BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n BIGINT;
BEGIN
  DELETE FROM public.agent_storefront_events WHERE created_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  purged_table := 'agent_storefront_events'; deleted_rows := n; RETURN NEXT;

  DELETE FROM public.research_events WHERE created_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  purged_table := 'research_events'; deleted_rows := n; RETURN NEXT;

  DELETE FROM public.auth_events WHERE created_at < now() - INTERVAL '180 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  purged_table := 'auth_events'; deleted_rows := n; RETURN NEXT;

  DELETE FROM public.web_vitals WHERE created_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  purged_table := 'web_vitals'; deleted_rows := n; RETURN NEXT;

  DELETE FROM public.client_error_events WHERE created_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  purged_table := 'client_error_events'; deleted_rows := n; RETURN NEXT;

  DELETE FROM public.faq_clicks WHERE created_at < now() - INTERVAL '180 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  purged_table := 'faq_clicks'; deleted_rows := n; RETURN NEXT;

  DELETE FROM public.missed_searches WHERE created_at < now() - INTERVAL '180 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  purged_table := 'missed_searches'; deleted_rows := n; RETURN NEXT;

  DELETE FROM public.search_queries WHERE created_at < now() - INTERVAL '365 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  purged_table := 'search_queries'; deleted_rows := n; RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_analytics_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_analytics_data() FROM anon;
REVOKE ALL ON FUNCTION public.purge_analytics_data() FROM authenticated;
