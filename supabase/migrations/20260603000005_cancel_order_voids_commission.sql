-- ============================================================
-- Sweep 18: Void commission on order cancellation
-- ============================================================
-- cancel_order RPC (20260529100001) marks orders.status='cancelled'
-- but does NOT touch agent_commissions rows. After the commission
-- trigger (20260603000002) was added, approved orders now create
-- commission rows — but if an already-approved order is then
-- cancelled, the commission row stays 'pending' forever.
--
-- Fix: update cancel_order to also mark any pending agent_commissions
-- rows for the same order as 'void' atomically in the same transaction.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id  UUID,
  p_reason    TEXT,
  p_refund_type TEXT,
  p_actor_id  UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order      RECORD;
  v_refund_id  UUID := NULL;
  v_remaining  NUMERIC;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status = 'cancelled' THEN RAISE EXCEPTION 'Order already cancelled'; END IF;

  v_remaining := v_order.total - COALESCE(v_order.refunded_amount, 0);
  IF v_remaining > 0 AND p_refund_type IS NOT NULL AND p_refund_type <> 'none' THEN
    v_refund_id := public.issue_refund(
      p_order_id,
      v_remaining,
      COALESCE(p_reason, 'Order Cancelled'),
      p_refund_type,
      false,
      NULL,
      p_actor_id
    );
  END IF;

  UPDATE public.orders
     SET status              = 'cancelled',
         cancellation_reason = p_reason,
         cancelled_by        = p_actor_id,
         updated_at          = NOW()
   WHERE id = p_order_id;

  -- Void any pending commission rows for this order.
  -- If the commission was already paid, leave it as-is (admin must manually
  -- handle that edge case via the commissions UI).
  UPDATE public.agent_commissions
     SET status = 'void',
         notes  = COALESCE(notes || ' | ', '') || 'Auto-voided: order cancelled (' || COALESCE(p_reason,'') || ')'
   WHERE order_id = p_order_id
     AND status   = 'pending';

  RETURN v_refund_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_order(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
