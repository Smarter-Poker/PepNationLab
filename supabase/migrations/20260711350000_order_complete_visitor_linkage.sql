-- =============================================================================
-- PURCHASE EVENT FUNNEL LINKAGE (SENTINEL Analytics Audit -- gap closure)
--
-- The order_complete trigger emitted server-authoritative revenue but with no
-- funnel linkage back to the anonymous browse session (session_id was a
-- synthetic 'srv_<orderid>' and visitor_id was null). This enriches the trigger
-- to look up the buyer's durable visitor id from marketing_attribution, so the
-- purchase step joins to acquisition (UTM/referrer) and browse-funnel sessions.
--
-- Still server-side and immune to route/client churn; no orders schema change.
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
  v_visitor_text TEXT;
  v_visitor      UUID;
BEGIN
  IF NEW.agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_buyer_role FROM public.profiles WHERE id = NEW.buyer_id;

  v_is_wholesale := COALESCE(NEW.is_wholesale_restock, false)
                    OR v_buyer_role IN ('agent', 'super_agent', 'admin');

  -- Funnel linkage: the buyer's most recent durable visitor id (shared with the
  -- attribution pipeline). Ties this purchase to the anonymous browse session.
  SELECT visitor_id INTO v_visitor_text
    FROM public.marketing_attribution
   WHERE user_id = NEW.buyer_id
   ORDER BY COALESCE(last_touch_at, first_touch_at) DESC
   LIMIT 1;

  BEGIN
    v_visitor := v_visitor_text::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_visitor := NULL;
  END;

  INSERT INTO public.agent_storefront_events (
    agent_id, visitor_id, session_id, event_type, path, order_id, amount_cents, is_wholesale, created_at
  ) VALUES (
    NEW.agent_id,
    v_visitor,
    COALESCE('vis_' || v_visitor_text, 'srv_' || NEW.id::text),
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
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_order_complete_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emit_order_complete_event() FROM anon;
REVOKE ALL ON FUNCTION public.emit_order_complete_event() FROM authenticated;
