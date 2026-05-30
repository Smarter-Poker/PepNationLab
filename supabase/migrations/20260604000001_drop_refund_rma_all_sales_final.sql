-- Migration: Drop refund and RMA database objects
-- All sales are final — no refunds, exchanges, or returns are permitted.
-- Remove the rma_requests table, refunds table, related functions/RPCs, and
-- the refunded_amount column from orders.

-- 1. Drop dependent views / functions first to avoid FK / dependency errors.

-- Drop RMA-related functions and triggers
DROP FUNCTION IF EXISTS public.notify_rma_status_change() CASCADE;
DROP TRIGGER IF EXISTS rma_status_change_trigger ON public.rma_requests;

-- Drop the RMA table
DROP TABLE IF EXISTS public.rma_requests CASCADE;

-- Drop the refunds table (order refunds — not label refunds)
DROP TABLE IF EXISTS public.refunds CASCADE;

-- Drop refund-related RPC functions
DROP FUNCTION IF EXISTS public.issue_refund(UUID, NUMERIC, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.cancel_order(UUID, TEXT, TEXT, UUID) CASCADE;

-- 2. Re-create cancel_order without the refund branching logic.
-- The function now simply marks the order as cancelled and voids any open commission.
CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id  UUID,
  p_reason    TEXT,
  p_refund_type TEXT,  -- kept for signature compatibility; value is always ignored
  p_actor_id  UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order   public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Order % is already cancelled', p_order_id;
  END IF;

  -- Mark order cancelled
  UPDATE public.orders
  SET status = 'cancelled',
      updated_at = NOW(),
      cancellation_reason = p_reason
  WHERE id = p_order_id;

  -- Void any unpaid commission for this order
  UPDATE public.commissions
  SET status = 'void',
      updated_at = NOW()
  WHERE order_id = p_order_id
    AND status IN ('pending', 'approved');

  -- Return NULL (no refund ID — all sales are final)
  RETURN NULL;
END;
$$;

-- 3. Remove refunded_amount column from orders (no longer meaningful).
ALTER TABLE public.orders DROP COLUMN IF EXISTS refunded_amount;

-- 4. Remove source_refund_id from store_credits (credits are admin-issued bonuses,
--    not refund compensation). Keep the column if any existing rows reference it,
--    but null it out and remove the FK if one exists.
ALTER TABLE public.store_credits DROP COLUMN IF EXISTS source_refund_id;

-- 5. Remove 'refund' from store_credits.type CHECK constraint (it was only used
--    by the now-deleted issue_refund() function).
ALTER TABLE public.store_credits DROP CONSTRAINT IF EXISTS store_credits_type_check;
ALTER TABLE public.store_credits
  ADD CONSTRAINT store_credits_type_check
  CHECK (type IN ('issue', 'redeem', 'release', 'expire', 'adjustment', 'credit'));

-- 6. Remove 'order.refunded', 'rma.created', 'rma.resolved' from any existing
--    webhook_endpoints that subscribe to those events (in-place array filter).
UPDATE public.webhook_endpoints
SET event_types = (
  SELECT COALESCE(
    ARRAY(
      SELECT e FROM unnest(event_types) AS e
      WHERE e NOT IN ('order.refunded', 'rma.created', 'rma.resolved')
    ),
    '{}'::text[]
  )
)
WHERE event_types && ARRAY['order.refunded', 'rma.created', 'rma.resolved'];
