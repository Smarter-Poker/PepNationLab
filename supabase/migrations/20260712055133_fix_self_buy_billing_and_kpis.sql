-- ============================================================================
-- Fix: forecast_next_statement - exclude self-buy orders from inflated forecast
-- ============================================================================
CREATE OR REPLACE FUNCTION public.forecast_next_statement(p_agent_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_total  NUMERIC;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;
  IF v_caller <> p_agent_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(
    COALESCE(o.subtotal, 0) - COALESCE(o.shipping_cost, 0)
  ), 0)
    INTO v_total
    FROM public.orders o
   WHERE o.agent_id = p_agent_id
     AND o.buyer_id IS DISTINCT FROM p_agent_id -- Exclude agent self-buys
     AND o.created_at >= date_trunc('week', NOW())
     AND o.status NOT IN ('cancelled')
     AND NOT EXISTS (SELECT 1 FROM public.statement_orders so WHERE so.order_id = o.id);

  RETURN COALESCE(v_total, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.forecast_next_statement(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.forecast_next_statement(UUID) TO authenticated, service_role;

-- ============================================================================
-- Fix: agent_sales_kpis - restrict new_users to role='researcher'
-- ============================================================================
DROP FUNCTION IF EXISTS public.agent_sales_kpis(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.agent_sales_kpis(
  p_agent_id UUID,
  p_start    TIMESTAMPTZ,
  p_end      TIMESTAMPTZ
)
RETURNS TABLE (
  revenue_cents   BIGINT,
  profit_cents    BIGINT,
  orders_count    INT,
  aov_cents       BIGINT,
  new_researchers INT,
  cancelled_count INT
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
       AND p.role = 'researcher' -- Exclude sub-agents
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
