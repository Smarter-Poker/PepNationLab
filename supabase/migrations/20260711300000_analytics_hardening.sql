-- =============================================================================
-- ANALYTICS HARDENING (SENTINEL Analytics Audit 2026-07-11)
--
-- 1. Extend agent_storefront_events with server-authoritative event types
--    (signup, remove_from_cart, order_cancelled), quantity, and a wholesale /
--    self-buy flag so restocks and agent self-purchases can be excluded from
--    retail funnel metrics.
-- 2. Dedupe: one order_complete and one order_cancelled row per order, and one
--    web_vitals row per metric_id. Kills the double-count on idempotency-key
--    replays and beacon retries.
-- 3. Privacy: raw event rows become admin-only (agents keep the aggregate 30d
--    views, which every consumer already reads through the service role). A
--    permanent browser id joined to search terms and order ids must not be
--    agent-readable row by row.
-- 4. Correct revenue: the 30d rollup now excludes wholesale/self-buy events and
--    nets out cancelled orders.
-- 5. Retention: purge_analytics_data() deletes aged telemetry; called by the
--    daily /api/cron/analytics-retention job.
-- =============================================================================

-- 1. Event type extension + new columns -------------------------------------

ALTER TABLE public.agent_storefront_events
  DROP CONSTRAINT IF EXISTS agent_storefront_events_event_type_check;

ALTER TABLE public.agent_storefront_events
  ADD CONSTRAINT agent_storefront_events_event_type_check
  CHECK (event_type IN (
    'pageview','product_view','search','add_to_cart','remove_from_cart',
    'checkout_start','order_complete','order_cancelled','signup'
  ));

ALTER TABLE public.agent_storefront_events
  ADD COLUMN IF NOT EXISTS quantity INTEGER CHECK (quantity IS NULL OR quantity > 0),
  ADD COLUMN IF NOT EXISTS is_wholesale BOOLEAN NOT NULL DEFAULT false;

-- 2. Dedupe indexes ----------------------------------------------------------

-- Exactly one revenue event and one cancellation event per order, regardless
-- of how many times a client or a replayed request tries to emit it.
CREATE UNIQUE INDEX IF NOT EXISTS uq_storefront_events_order_complete
  ON public.agent_storefront_events(order_id)
  WHERE event_type = 'order_complete' AND order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_storefront_events_order_cancelled
  ON public.agent_storefront_events(order_id)
  WHERE event_type = 'order_cancelled' AND order_id IS NOT NULL;

-- web-vitals beacons carry a stable per-measurement metric_id; drop replays.
-- Clean existing duplicates (bfcache restores / keepalive replays) first.
DELETE FROM public.web_vitals a
USING public.web_vitals b
WHERE a.metric_id IS NOT NULL
  AND a.metric_id = b.metric_id
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_web_vitals_metric_id
  ON public.web_vitals(metric_id)
  WHERE metric_id IS NOT NULL;

-- 3. Privacy: raw rows admin-only ---------------------------------------------
-- Dashboards (agent analytics page, super rollup, researcher insights) all read
-- through the service role, which bypasses RLS; nothing user-facing queries the
-- raw table with a user-scoped client. Aggregate views remain available.

DROP POLICY IF EXISTS storefront_events_agent_select ON public.agent_storefront_events;
CREATE POLICY storefront_events_admin_select ON public.agent_storefront_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- 4. Corrected 30d rollup ------------------------------------------------------
-- Retail-only funnel: wholesale restocks and agent self-buys are excluded, and
-- orders that were cancelled inside the window are netted out of orders/revenue.

CREATE OR REPLACE VIEW public.agent_storefront_analytics_30d
WITH (security_invoker = true) AS
WITH ev AS (
  SELECT *
  FROM public.agent_storefront_events
  WHERE created_at >= now() - INTERVAL '30 days'
    AND is_wholesale = false
),
cancelled AS (
  SELECT order_id FROM ev
  WHERE event_type = 'order_cancelled' AND order_id IS NOT NULL
)
SELECT
  agent_id,
  COUNT(*) FILTER (WHERE event_type = 'pageview')                            AS pageviews_30d,
  COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'pageview')          AS unique_sessions_30d,
  COUNT(*) FILTER (WHERE event_type = 'add_to_cart')                         AS add_to_cart_30d,
  COUNT(*) FILTER (WHERE event_type = 'checkout_start')                      AS checkout_starts_30d,
  COUNT(*) FILTER (
    WHERE event_type = 'order_complete'
      AND (order_id IS NULL OR order_id NOT IN (SELECT order_id FROM cancelled))
  )                                                                          AS orders_30d,
  COALESCE(SUM(amount_cents) FILTER (
    WHERE event_type = 'order_complete'
      AND (order_id IS NULL OR order_id NOT IN (SELECT order_id FROM cancelled))
  ), 0)                                                                      AS revenue_cents_30d,
  CASE
    WHEN COUNT(*) FILTER (WHERE event_type = 'pageview') > 0
    THEN ROUND(
      (COUNT(*) FILTER (
        WHERE event_type = 'order_complete'
          AND (order_id IS NULL OR order_id NOT IN (SELECT order_id FROM cancelled))
      )::numeric * 100) /
       NULLIF(COUNT(*) FILTER (WHERE event_type = 'pageview'), 0),
      2
    )
    ELSE 0
  END AS conversion_pct_30d
FROM ev
GROUP BY agent_id;

GRANT SELECT ON public.agent_storefront_analytics_30d TO authenticated;

-- 5. Retention ----------------------------------------------------------------

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

-- 6. Privacy minimization on adjacent telemetry --------------------------------
-- Web vitals and FAQ clicks do not need user identity; scrub what was collected.

UPDATE public.web_vitals SET user_id = NULL WHERE user_id IS NOT NULL;
UPDATE public.faq_clicks SET user_id = NULL WHERE user_id IS NOT NULL;
