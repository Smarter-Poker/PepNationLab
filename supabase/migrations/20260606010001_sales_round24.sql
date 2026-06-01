-- Round 24 Sales build (Phase 3)
-- Adds: agent_sales_goals + agent_saved_views tables, four hot-path indexes,
--       and SECURITY DEFINER aggregation RPCs (KPIs / timeseries / tax / abandoned).

BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_sales_goals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  target_cents BIGINT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, period_start)
);
CREATE INDEX IF NOT EXISTS agent_sales_goals_agent_idx
  ON public.agent_sales_goals (agent_id, period_start DESC);
ALTER TABLE public.agent_sales_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_goals_self ON public.agent_sales_goals;
CREATE POLICY sales_goals_self ON public.agent_sales_goals
  FOR ALL TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin())
  WITH CHECK (agent_id = auth.uid() OR public.is_admin());

CREATE TABLE IF NOT EXISTS public.agent_saved_views (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  filters_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.agent_saved_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saved_views_self ON public.agent_saved_views;
CREATE POLICY saved_views_self ON public.agent_saved_views
  FOR ALL TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin())
  WITH CHECK (agent_id = auth.uid() OR public.is_admin());

-- Hot-path indexes
CREATE INDEX IF NOT EXISTS orders_agent_created_partial_idx
  ON public.orders (agent_id, created_at DESC)
  WHERE is_wholesale_restock = false;

CREATE INDEX IF NOT EXISTS orders_agent_status_idx
  ON public.orders (agent_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS profiles_referring_cart_idx
  ON public.profiles (referring_agent_id, cart_updated_at DESC)
  WHERE cart_state IS NOT NULL;

-- ============================================================================
-- RPC: agent_sales_kpis
-- One round-trip for the KPI strip. Filtered by date range.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.agent_sales_kpis(
  p_agent_id UUID,
  p_start    TIMESTAMPTZ,
  p_end      TIMESTAMPTZ
)
RETURNS TABLE (
  revenue_cents     BIGINT,
  profit_cents      BIGINT,
  orders_count      INT,
  aov_cents         BIGINT,
  new_researchers   INT,
  cancelled_count   INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;
  IF v_caller <> p_agent_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH live AS (
    SELECT o.* FROM public.orders o
     WHERE o.agent_id = p_agent_id
       AND o.created_at >= p_start
       AND o.created_at <  p_end
       AND COALESCE(o.is_wholesale_restock, false) = false
       AND o.status <> 'cancelled'
  ),
  cancelled AS (
    SELECT COUNT(*)::INT AS c FROM public.orders o
     WHERE o.agent_id = p_agent_id
       AND o.created_at >= p_start
       AND o.created_at <  p_end
       AND o.status = 'cancelled'
  ),
  new_users AS (
    SELECT COUNT(*)::INT AS c FROM public.profiles p
     WHERE p.referring_agent_id = p_agent_id
       AND p.created_at >= p_start
       AND p.created_at <  p_end
  ),
  rev AS (
    SELECT
      COALESCE(SUM((COALESCE(o.total,0))      * 100), 0)::BIGINT AS revenue_cents,
      COALESCE(SUM((COALESCE(o.total,0)
                    - COALESCE(o.discount_amount,0)
                    - COALESCE(o.shipping_cost,0)) * 100), 0)::BIGINT AS profit_cents,
      COUNT(*)::INT AS orders_count
    FROM live o
  )
  SELECT
    rev.revenue_cents,
    rev.profit_cents,
    rev.orders_count,
    CASE WHEN rev.orders_count > 0 THEN (rev.revenue_cents / rev.orders_count) ELSE 0 END,
    new_users.c,
    cancelled.c
  FROM rev, cancelled, new_users;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_sales_kpis(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_sales_kpis(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

-- ============================================================================
-- RPC: agent_sales_timeseries — zero-filled day buckets
-- ============================================================================
CREATE OR REPLACE FUNCTION public.agent_sales_timeseries(
  p_agent_id UUID,
  p_start    TIMESTAMPTZ,
  p_end      TIMESTAMPTZ
)
RETURNS TABLE (
  day             DATE,
  revenue_cents   BIGINT,
  profit_cents    BIGINT,
  orders_count    INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  IF v_caller <> p_agent_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(p_start::date, (p_end - INTERVAL '1 day')::date, INTERVAL '1 day')::date AS day
  ),
  agg AS (
    SELECT
      o.created_at::date AS day,
      SUM((COALESCE(o.total, 0)) * 100)::BIGINT AS revenue_cents,
      SUM((COALESCE(o.total, 0)
           - COALESCE(o.discount_amount, 0)
           - COALESCE(o.shipping_cost, 0)) * 100)::BIGINT AS profit_cents,
      COUNT(*)::INT AS orders_count
    FROM public.orders o
    WHERE o.agent_id = p_agent_id
      AND o.created_at >= p_start
      AND o.created_at <  p_end
      AND COALESCE(o.is_wholesale_restock, false) = false
      AND o.status <> 'cancelled'
    GROUP BY o.created_at::date
  )
  SELECT
    days.day,
    COALESCE(agg.revenue_cents, 0)::BIGINT,
    COALESCE(agg.profit_cents, 0)::BIGINT,
    COALESCE(agg.orders_count, 0)::INT
  FROM days LEFT JOIN agg USING (day)
  ORDER BY days.day;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_sales_timeseries(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_sales_timeseries(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

-- ============================================================================
-- RPC: agent_sales_tax_summary — per-state breakdown for year
-- ============================================================================
CREATE OR REPLACE FUNCTION public.agent_sales_tax_summary(
  p_agent_id UUID,
  p_year     INT
)
RETURNS TABLE (
  state               TEXT,
  orders_count        INT,
  gross_revenue_cents BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  IF v_caller <> p_agent_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(NULLIF(TRIM(o.shipping_address->>'state'), ''), 'UNKNOWN')::TEXT AS state,
    COUNT(*)::INT AS orders_count,
    SUM((COALESCE(o.total, 0)) * 100)::BIGINT AS gross_revenue_cents
  FROM public.orders o
  WHERE o.agent_id = p_agent_id
    AND EXTRACT(YEAR FROM o.created_at) = p_year
    AND COALESCE(o.is_wholesale_restock, false) = false
    AND o.status <> 'cancelled'
  GROUP BY state
  ORDER BY gross_revenue_cents DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_sales_tax_summary(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_sales_tax_summary(UUID, INT) TO authenticated, service_role;

COMMIT;
