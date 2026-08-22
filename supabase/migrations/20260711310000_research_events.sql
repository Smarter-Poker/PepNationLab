-- =============================================================================
-- RESEARCH ENGAGEMENT EVENTS (SENTINEL Analytics Audit 2026-07-11)
--
-- The research side of the platform (monographs, reconstitution calculator,
-- external-document IframeModal, COA pages) had zero engagement tracking.
-- One generic sink table instead of five bespoke endpoints.
--
-- Privacy by design: NO user_id and NO IP column. Research engagement must
-- never be linkable to an identified person (research-use-only posture).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.research_events (
  id            BIGSERIAL PRIMARY KEY,
  session_id    TEXT NOT NULL,
  visitor_id    UUID,
  event_type    TEXT NOT NULL CHECK (event_type IN (
    'page_view','tab_view','calculator_used','external_doc_open','coa_view','match_result_click'
  )),
  path          TEXT,
  compound_slug TEXT,
  tool          TEXT,
  url_host      TEXT,
  detail        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_events_type_time
  ON public.research_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_events_compound
  ON public.research_events(compound_slug)
  WHERE compound_slug IS NOT NULL;

ALTER TABLE public.research_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_events_admin_select ON public.research_events;
CREATE POLICY research_events_admin_select ON public.research_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- No insert policies: writes go through the service-role endpoint only.

-- Extend the retention purge with research_events (90 days), keeping the body
-- from 20260711300000_analytics_hardening.sql otherwise identical.
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
