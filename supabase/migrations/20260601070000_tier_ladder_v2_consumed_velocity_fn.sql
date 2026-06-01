-- ============================================================================
-- Velocity caps (flag-gated): a sub-agent's "consumed" virtual velocity is the
-- total value of their orders placed but not yet Approved-for-Shipment (and not
-- cancelled). Once an order reaches approved_ship/approved_pickup it settles
-- against the super-agent's real House credit (existing billing path) and no
-- longer counts against the sub-agent's virtual cap. SECURITY DEFINER so the
-- order route (service role) and dashboards can call it under RLS.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_sub_agent_consumed_velocity(p_sub uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(o.total), 0)::numeric
  FROM orders o
  WHERE o.agent_id = p_sub
    AND o.status IN ('pending_customer_payment', 'agent_approval_pending', 'admin_approval_pending');
$$;

COMMENT ON FUNCTION public.fn_sub_agent_consumed_velocity(uuid) IS
  'Sum of a sub-agent''s pre-shipment (unsettled) order totals; the amount currently held against their virtual velocity_cap. Settled orders (approved_ship+) draw on the super-agent House credit instead.';
