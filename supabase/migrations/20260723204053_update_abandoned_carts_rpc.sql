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
        'name', coalesce(pr.name, 'Unknown Product'),
        'added_at', e.created_at
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
      'items', c.items,
      'user_name', p.full_name,
      'user_email', p.email
    ) ORDER BY a.last_active DESC
  ), '[]'::jsonb) INTO v_result
  FROM abandoned_sessions a
  JOIN cart_items c ON a.session_id = c.session_id
  LEFT JOIN public.marketing_attribution ma ON ma.visitor_id = a.visitor_id::text
  LEFT JOIN public.profiles p ON p.id = ma.user_id;

  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_abandoned_carts(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_abandoned_carts(uuid, int) TO service_role;
