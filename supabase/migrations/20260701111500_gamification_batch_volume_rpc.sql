-- ============================================================================
-- Gamification Volume Batch RPC (Downline Leaderboard optimization)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_agent_own_wholesale_30d_batch(agent_ids uuid[])
RETURNS TABLE(agent_id uuid, volume numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.agent_id, COALESCE(SUM(oi.unit_cost_price * oi.quantity), 0)::numeric AS volume
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.agent_id = ANY(agent_ids)
    AND o.status <> 'cancelled'
    AND o.created_at >= now() - interval '30 days'
  GROUP BY o.agent_id;
$$;
