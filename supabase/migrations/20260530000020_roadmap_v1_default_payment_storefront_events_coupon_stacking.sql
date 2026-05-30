-- =============================================================================
-- Roadmap v1 — 2026-05-29
-- profiles.default_payment_method        : default checkout payment surface
-- coupons.stacking_policy                : JSON rules for the stacking engine
-- agent_storefront_events                : pageview / search / add-to-cart /
--                                          conversion telemetry for agent
--                                          analytics dashboards
-- agent_storefront_analytics_30d         : aggregate view per agent
-- agent_top_search_terms_30d             : top-N search terms per agent
-- Applied to ydsaqnnuwyvtyxgvrnys via Supabase MCP on 2026-05-29.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_payment_method TEXT
  CHECK (default_payment_method IS NULL OR default_payment_method IN ('zelle','venmo','cashapp','apple_pay'));

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS stacking_policy JSONB NOT NULL DEFAULT jsonb_build_object(
    'allow_with_bundles', true,
    'allow_with_sale_items', true,
    'exclude_codes', '[]'::jsonb,
    'max_stack', 1
  );

CREATE TABLE IF NOT EXISTS public.agent_storefront_events (
  id            BIGSERIAL PRIMARY KEY,
  agent_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visitor_id    UUID,
  session_id    TEXT NOT NULL,
  event_type    TEXT NOT NULL CHECK (event_type IN (
    'pageview','product_view','search','add_to_cart','checkout_start','order_complete'
  )),
  path          TEXT,
  search_term   TEXT,
  product_id    UUID REFERENCES public.products(id) ON DELETE SET NULL,
  order_id      UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount_cents  INTEGER,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storefront_events_agent_time
  ON public.agent_storefront_events(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storefront_events_session
  ON public.agent_storefront_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_storefront_events_search
  ON public.agent_storefront_events(agent_id, search_term)
  WHERE search_term IS NOT NULL;

ALTER TABLE public.agent_storefront_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storefront_events_agent_select ON public.agent_storefront_events;
CREATE POLICY storefront_events_agent_select ON public.agent_storefront_events
  FOR SELECT TO authenticated
  USING (
    agent_id = (SELECT auth.uid())
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = (SELECT auth.uid())
         AND p.is_super_agent = true
         AND EXISTS (
           SELECT 1 FROM public.profiles sub
            WHERE sub.id = public.agent_storefront_events.agent_id
              AND sub.parent_agent_id = p.id
         )
    )
  );

DROP POLICY IF EXISTS storefront_events_anon_insert ON public.agent_storefront_events;
CREATE POLICY storefront_events_anon_insert ON public.agent_storefront_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE OR REPLACE VIEW public.agent_storefront_analytics_30d
WITH (security_invoker = true) AS
SELECT
  agent_id,
  COUNT(*) FILTER (WHERE event_type = 'pageview')                              AS pageviews_30d,
  COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'pageview')            AS unique_sessions_30d,
  COUNT(*) FILTER (WHERE event_type = 'add_to_cart')                           AS add_to_cart_30d,
  COUNT(*) FILTER (WHERE event_type = 'checkout_start')                        AS checkout_starts_30d,
  COUNT(*) FILTER (WHERE event_type = 'order_complete')                        AS orders_30d,
  COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'order_complete'), 0)  AS revenue_cents_30d,
  CASE
    WHEN COUNT(*) FILTER (WHERE event_type = 'pageview') > 0
    THEN ROUND(
      (COUNT(*) FILTER (WHERE event_type = 'order_complete')::numeric * 100) /
       NULLIF(COUNT(*) FILTER (WHERE event_type = 'pageview'), 0),
      2
    )
    ELSE 0
  END AS conversion_pct_30d
FROM public.agent_storefront_events
WHERE created_at >= now() - INTERVAL '30 days'
GROUP BY agent_id;

GRANT SELECT ON public.agent_storefront_analytics_30d TO authenticated;

CREATE OR REPLACE VIEW public.agent_top_search_terms_30d
WITH (security_invoker = true) AS
SELECT
  agent_id,
  LOWER(TRIM(search_term)) AS term,
  COUNT(*)                 AS searches
FROM public.agent_storefront_events
WHERE event_type = 'search'
  AND search_term IS NOT NULL
  AND TRIM(search_term) <> ''
  AND created_at >= now() - INTERVAL '30 days'
GROUP BY agent_id, LOWER(TRIM(search_term));

GRANT SELECT ON public.agent_top_search_terms_30d TO authenticated;
