-- =============================================================================
-- SERVER-AUTHORITATIVE order_complete VIA TRIGGER (SENTINEL Analytics Audit)
--
-- The purchase event is the single most important analytics signal on the
-- platform. It was previously client-only (lost to ad blockers / tab closes),
-- then briefly emitted from POST /api/orders. Because the orders route is a
-- hot, frequently-refactored file, a route-level emission is fragile: it is
-- easy to drop in a rewrite, and when both the client call and the route call
-- are gone the purchase event fires nowhere.
--
-- This trigger makes order_complete a guaranteed side effect of an order row
-- existing, using server-authoritative columns (agent, total, wholesale). It
-- cannot be lost to client conditions or route refactors, and the existing
-- partial unique index uq_storefront_events_order_complete guarantees exactly
-- one row per order even if a route or client also emits (that duplicate insert
-- simply conflicts and is ignored).
--
-- session_id/visitor_id funnel linkage is not available at the DB layer; the
-- critical revenue/order/agent/wholesale data is. Wholesale restocks and
-- purchases made by agents/super-agents/admins (self-buys) are flagged so the
-- retail funnel view (agent_storefront_analytics_30d) excludes them.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.emit_order_complete_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_wholesale BOOLEAN;
  v_buyer_role   TEXT;
BEGIN
  -- agent_storefront_events.agent_id is NOT NULL; an order with no agent
  -- attribution has nothing to attribute the purchase to.
  IF NEW.agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_buyer_role FROM public.profiles WHERE id = NEW.buyer_id;

  -- Exclude restocks and agent/super-agent/admin self-buys from retail metrics.
  v_is_wholesale := COALESCE(NEW.is_wholesale_restock, false)
                    OR v_buyer_role IN ('agent', 'super_agent', 'admin');

  -- ON CONFLICT DO NOTHING against the partial unique index makes this idempotent
  -- even if a client or route path also emits an order_complete for this order.
  INSERT INTO public.agent_storefront_events (
    agent_id, session_id, event_type, path, order_id, amount_cents, is_wholesale, created_at
  ) VALUES (
    NEW.agent_id,
    'srv_' || NEW.id::text,
    'order_complete',
    '/checkout',
    NEW.id,
    GREATEST(0, ROUND(COALESCE(NEW.total, 0) * 100))::int,
    v_is_wholesale,
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (order_id) WHERE (event_type = 'order_complete' AND order_id IS NOT NULL)
  DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Analytics must never break order creation. Swallow and continue.
  RETURN NEW;
END;
$$;

-- Trigger functions must not be directly callable by client roles. The trigger
-- fires as the table owner regardless, so revoking EXECUTE does not affect it.
REVOKE ALL ON FUNCTION public.emit_order_complete_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emit_order_complete_event() FROM anon;
REVOKE ALL ON FUNCTION public.emit_order_complete_event() FROM authenticated;

DROP TRIGGER IF EXISTS trg_emit_order_complete ON public.orders;
CREATE TRIGGER trg_emit_order_complete
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_order_complete_event();
