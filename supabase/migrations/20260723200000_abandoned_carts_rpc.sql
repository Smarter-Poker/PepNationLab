-- Update Site Traffic Summary to include abandoned carts count
-- Add RPC to fetch abandoned carts drill-down data

CREATE OR REPLACE FUNCTION public.site_traffic_summary(p_agent_id uuid DEFAULT NULL, p_days int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_days  int := greatest(1, least(coalesce(p_days, 7), 90));
  v_since timestamptz := now() - (v_days || ' days')::interval;
  v_result jsonb;
BEGIN
  WITH ev AS (
    SELECT * FROM public.agent_storefront_events
    WHERE created_at >= v_since
      AND (p_agent_id IS NULL OR agent_id = p_agent_id)
  ),
  totals AS (
    SELECT
      count(*) FILTER (WHERE event_type='pageview')       AS pageviews,
      count(DISTINCT visitor_id) FILTER (WHERE visitor_id IS NOT NULL) AS visitors,
      count(*) FILTER (WHERE event_type='product_view')   AS product_views,
      count(*) FILTER (WHERE event_type='search')         AS searches,
      count(*) FILTER (WHERE event_type='add_to_cart')    AS add_to_cart,
      count(*) FILTER (WHERE event_type='checkout_start') AS checkout_start,
      (
        SELECT count(DISTINCT e1.session_id)
        FROM ev e1
        WHERE e1.event_type = 'add_to_cart'
          AND NOT EXISTS (
            SELECT 1 FROM ev e2
            WHERE e2.session_id = e1.session_id
              AND e2.event_type = 'order_complete'
          )
      ) AS abandoned_carts,
      (
        SELECT count(*)
        FROM public.orders
        WHERE created_at >= v_since
          AND (p_agent_id IS NULL OR agent_id = p_agent_id)
          AND status != 'cancelled'
      ) AS orders,
      count(*) FILTER (WHERE event_type='signup')         AS signups,
      (
        SELECT coalesce(sum(total * 100), 0)
        FROM public.orders
        WHERE created_at >= v_since
          AND (p_agent_id IS NULL OR agent_id = p_agent_id)
          AND status != 'cancelled'
      ) AS gmv_cents
    FROM ev
  ),
  trend AS (
    SELECT jsonb_agg(jsonb_build_object('day', d, 'pageviews', pv, 'visitors', vis) ORDER BY d) AS arr
    FROM (
      SELECT date_trunc('day', created_at)::date AS d,
             count(*) FILTER (WHERE event_type='pageview') AS pv,
             count(DISTINCT visitor_id) FILTER (WHERE visitor_id IS NOT NULL) AS vis
      FROM ev GROUP BY 1
    ) t
  ),
  top_search AS (
    SELECT jsonb_agg(jsonb_build_object('term', term, 'n', n) ORDER BY n DESC) AS arr
    FROM (
      SELECT lower(trim(search_term)) AS term, count(*) AS n
      FROM ev WHERE event_type='search' AND coalesce(trim(search_term),'') <> ''
      GROUP BY 1 ORDER BY n DESC LIMIT 8
    ) s
  ),
  top_prod AS (
    SELECT jsonb_agg(jsonb_build_object('product_id', pid, 'name', coalesce(pr.name,'Unknown'), 'n', n) ORDER BY n DESC) AS arr
    FROM (
      SELECT product_id AS pid, count(*) AS n FROM ev
      WHERE event_type='product_view' AND product_id IS NOT NULL
      GROUP BY 1 ORDER BY n DESC LIMIT 8
    ) x
    LEFT JOIN public.products pr ON pr.id = x.pid
  ),
  top_store AS (
    SELECT coalesce(jsonb_agg(jsonb_build_object('agent_id', aid, 'name', nm, 'pageviews', n) ORDER BY n DESC), '[]'::jsonb) AS arr
    FROM (
      SELECT e.agent_id AS aid,
             coalesce(ap.display_name, pf.full_name, pf.username, 'Unknown') AS nm,
             count(*) FILTER (WHERE e.event_type='pageview') AS n
      FROM ev e
      LEFT JOIN public.agent_profiles ap ON ap.id = e.agent_id
      LEFT JOIN public.profiles pf ON pf.id = e.agent_id
      WHERE p_agent_id IS NULL AND e.agent_id IS NOT NULL
      GROUP BY e.agent_id, ap.display_name, pf.full_name, pf.username
      ORDER BY n DESC LIMIT 8
    ) z
  )
  SELECT jsonb_build_object(
    'days', v_days, 'since', v_since,
    'scope', CASE WHEN p_agent_id IS NULL THEN 'global' ELSE 'agent' END,
    'totals', (SELECT to_jsonb(x) FROM totals x),
    'trend', coalesce((SELECT arr FROM trend), '[]'::jsonb),
    'top_searches', coalesce((SELECT arr FROM top_search), '[]'::jsonb),
    'top_products', coalesce((SELECT arr FROM top_prod), '[]'::jsonb),
    'top_storefronts', coalesce((SELECT arr FROM top_store), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;


CREATE OR REPLACE FUNCTION public.get_abandoned_carts(p_agent_id uuid DEFAULT NULL, p_days int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_days  int := greatest(1, least(coalesce(p_days, 7), 90));
  v_since timestamptz := now() - (v_days || ' days')::interval;
  v_result jsonb;
BEGIN
  WITH ev AS (
    SELECT * FROM public.agent_storefront_events
    WHERE created_at >= v_since
      AND (p_agent_id IS NULL OR agent_id = p_agent_id)
  ),
  abandoned_sessions AS (
    SELECT session_id, visitor_id, max(created_at) as last_active
    FROM ev
    WHERE event_type = 'add_to_cart'
    GROUP BY session_id, visitor_id
    HAVING NOT EXISTS (
      SELECT 1 FROM ev e2
      WHERE e2.session_id = ev.session_id
        AND e2.event_type = 'order_complete'
    )
  ),
  cart_items AS (
    SELECT s.session_id, jsonb_agg(
      jsonb_build_object(
        'product_id', e.product_id,
        'quantity', coalesce(e.quantity, 1),
        'name', coalesce(pr.name, 'Unknown Product')
      ) ORDER BY e.created_at DESC
    ) as items
    FROM abandoned_sessions s
    JOIN ev e ON e.session_id = s.session_id AND e.event_type = 'add_to_cart'
    LEFT JOIN public.products pr ON pr.id = e.product_id
    GROUP BY s.session_id
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'session_id', a.session_id,
      'visitor_id', a.visitor_id,
      'last_active', a.last_active,
      'items', c.items
    ) ORDER BY a.last_active DESC
  ), '[]'::jsonb) INTO v_result
  FROM abandoned_sessions a
  JOIN cart_items c ON a.session_id = c.session_id;

  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_abandoned_carts(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_abandoned_carts(uuid, int) TO service_role;
