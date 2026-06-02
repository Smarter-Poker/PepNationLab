-- Align the Sales Performance RPCs with the authoritative Sales & Accounting tab.
--  * Revenue/profit/orders now count only COLLECTED orders (approved+), matching
--    the dashboard "collected" definition. Previously counted every non-cancelled
--    order including unpaid pending_customer_payment, overstating revenue.
--  * Profit now subtracts product COGS (order_items.unit_cost_price * quantity).
--    Previously profit = total - discount - shipping with NO product cost, so
--    "Profit" was effectively equal to revenue (e.g. $716 shown vs $227 real).
-- Signatures and return columns are unchanged.

CREATE OR REPLACE FUNCTION public.agent_sales_kpis(p_agent_id uuid, p_start timestamptz, p_end timestamptz)
 RETURNS TABLE(revenue_cents bigint, profit_cents bigint, orders_count integer, aov_cents bigint, new_researchers integer, cancelled_count integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  IF v_caller <> p_agent_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH live AS (
    SELECT o.id,
           COALESCE(o.total, 0)           AS total,
           COALESCE(o.discount_amount, 0) AS discount,
           COALESCE(o.shipping_cost, 0)   AS shipping
    FROM public.orders o
    WHERE o.agent_id = p_agent_id
      AND o.created_at >= p_start
      AND o.created_at <  p_end
      AND COALESCE(o.is_wholesale_restock, false) = false
      AND o.status IN ('approved_ship','approved_pickup','in_fulfillment','shipped','delivered')
  ),
  ic AS (
    SELECT oi.order_id,
           SUM(COALESCE(oi.unit_retail_price, 0) * COALESCE(oi.quantity, 0)) AS retail,
           SUM(COALESCE(oi.unit_cost_price, 0)   * COALESCE(oi.quantity, 0)) AS cogs
    FROM public.order_items oi
    WHERE oi.order_id IN (SELECT id FROM live)
    GROUP BY oi.order_id
  ),
  cancelled AS (
    SELECT COUNT(*)::int AS c FROM public.orders o
     WHERE o.agent_id = p_agent_id
       AND o.created_at >= p_start AND o.created_at < p_end
       AND o.status = 'cancelled'
  ),
  new_users AS (
    SELECT COUNT(*)::int AS c FROM public.profiles p
     WHERE p.referring_agent_id = p_agent_id
       AND p.created_at >= p_start AND p.created_at < p_end
  ),
  rev AS (
    SELECT
      COALESCE(SUM(l.total * 100), 0)::bigint AS revenue_cents,
      COALESCE(SUM((COALESCE(ic.retail, 0) - l.discount - COALESCE(ic.cogs, 0) - l.shipping) * 100), 0)::bigint AS profit_cents,
      COUNT(*)::int AS orders_count
    FROM live l LEFT JOIN ic ON ic.order_id = l.id
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
$function$;

CREATE OR REPLACE FUNCTION public.agent_sales_timeseries(p_agent_id uuid, p_start timestamptz, p_end timestamptz)
 RETURNS TABLE(day date, revenue_cents bigint, profit_cents bigint, orders_count integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  IF v_caller <> p_agent_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(p_start::date, (p_end - INTERVAL '1 day')::date, INTERVAL '1 day')::date AS day
  ),
  live AS (
    SELECT o.id,
           o.created_at::date             AS day,
           COALESCE(o.total, 0)           AS total,
           COALESCE(o.discount_amount, 0) AS discount,
           COALESCE(o.shipping_cost, 0)   AS shipping
    FROM public.orders o
    WHERE o.agent_id = p_agent_id
      AND o.created_at >= p_start
      AND o.created_at <  p_end
      AND COALESCE(o.is_wholesale_restock, false) = false
      AND o.status IN ('approved_ship','approved_pickup','in_fulfillment','shipped','delivered')
  ),
  ic AS (
    SELECT oi.order_id,
           SUM(COALESCE(oi.unit_retail_price, 0) * COALESCE(oi.quantity, 0)) AS retail,
           SUM(COALESCE(oi.unit_cost_price, 0)   * COALESCE(oi.quantity, 0)) AS cogs
    FROM public.order_items oi
    WHERE oi.order_id IN (SELECT id FROM live)
    GROUP BY oi.order_id
  ),
  agg AS (
    SELECT l.day,
      SUM(l.total * 100)::bigint AS revenue_cents,
      SUM((COALESCE(ic.retail, 0) - l.discount - COALESCE(ic.cogs, 0) - l.shipping) * 100)::bigint AS profit_cents,
      COUNT(*)::int AS orders_count
    FROM live l LEFT JOIN ic ON ic.order_id = l.id
    GROUP BY l.day
  )
  SELECT
    days.day,
    COALESCE(agg.revenue_cents, 0)::bigint,
    COALESCE(agg.profit_cents, 0)::bigint,
    COALESCE(agg.orders_count, 0)::int
  FROM days LEFT JOIN agg USING (day)
  ORDER BY days.day;
END;
$function$;
