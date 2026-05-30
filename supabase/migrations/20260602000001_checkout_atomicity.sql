-- ============================================================
-- PEP NATION LAB — Checkout Atomicity Hardening
-- Migration: 20260602000001_checkout_atomicity
-- ============================================================
-- Fixes three critical race conditions in the checkout flow:
--
-- 1. COUPON BURN ON ROLLBACK
--    redeem_coupon increments uses_count before the order is committed.
--    If order_items INSERT fails and the order is rolled back (deleted),
--    the coupon count stays incremented. The new unreedeem_coupon function
--    is called in the rollback path to restore the count.
--
-- 2. INVENTORY TOCTOU (Time-Of-Check-Time-Of-Use)
--    The route reads inventory_count then checks qty, but two concurrent
--    requests can both read the same count and both pass. The existing
--    trigger deducts at APPROVAL time (with FOR UPDATE), but by then
--    two orders exist for the same limited stock. This migration adds
--    reserve_inventory that atomically claims stock at ORDER CREATION
--    time so oversold orders never reach approval.
--
-- 3. STORE CREDIT DOUBLE-SPEND WINDOW
--    redeem_store_credit is called AFTER order + items are committed.
--    If it fails, we attempt to delete the order (best-effort rollback).
--    By moving the credit deduction BEFORE the order insert (using the
--    existing SECURITY DEFINER RPC), the order never exists without a
--    matching credit deduction. A compensating release_credit RPC
--    restores credit if the order insert subsequently fails.
-- ============================================================

-- ── 1. COUPON UNREEDEEM ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unreedeem_coupon(p_coupon_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.coupons
  SET uses_count = GREATEST(0, uses_count - 1)
  WHERE id = p_coupon_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.unreedeem_coupon(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unreedeem_coupon(UUID) TO authenticated;

-- ── 2. INVENTORY RESERVATION ─────────────────────────────────────────────────
-- Atomically reserves stock at order-creation time using SELECT FOR UPDATE.
-- p_items: JSONB array of {product_id: UUID, quantity: int}
CREATE OR REPLACE FUNCTION public.reserve_inventory(p_items JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item    RECORD;
  v_product RECORD;
BEGIN
  FOR v_item IN
    SELECT
      (elem->>'product_id')::UUID  AS product_id,
      (elem->>'quantity')::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) AS elem
    ORDER BY (elem->>'product_id')
  LOOP
    SELECT id, name, inventory_count
    INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_item.product_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_product.inventory_count < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient inventory for "%". Only % in stock, % requested.',
        v_product.name, v_product.inventory_count, v_item.quantity
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.products
    SET inventory_count = inventory_count - v_item.quantity,
        updated_at = NOW()
    WHERE id = v_item.product_id;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_inventory(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_inventory(JSONB) TO authenticated;

-- ── 3. INVENTORY RELEASE ─────────────────────────────────────────────────────
-- Called when a pre-reservation succeeded but subsequent order insert failed.
CREATE OR REPLACE FUNCTION public.release_inventory(p_items JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item RECORD;
BEGIN
  FOR v_item IN
    SELECT
      (elem->>'product_id')::UUID  AS product_id,
      (elem->>'quantity')::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) AS elem
  LOOP
    UPDATE public.products
    SET inventory_count = inventory_count + v_item.quantity,
        updated_at = NOW()
    WHERE id = v_item.product_id;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_inventory(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_inventory(JSONB) TO authenticated;

-- ── 4. STORE CREDIT RELEASE ──────────────────────────────────────────────────
-- Called when store credit was pre-debited but order insert failed.
CREATE OR REPLACE FUNCTION public.release_store_credit(
  p_user_id    UUID,
  p_amount     NUMERIC,
  p_order_id   UUID,
  p_description TEXT DEFAULT 'Order Cancelled - Credit Restored'
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before NUMERIC;
  v_after  NUMERIC;
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_before
  FROM public.store_credits
  WHERE user_id = p_user_id;

  v_after := v_before + p_amount;

  INSERT INTO public.store_credits (
    user_id, amount, balance_before, balance_after,
    type, source_order_id, description, created_by
  )
  VALUES (
    p_user_id, p_amount, v_before, v_after,
    'release', p_order_id, p_description, p_user_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_store_credit(UUID, NUMERIC, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_store_credit(UUID, NUMERIC, UUID, TEXT) TO authenticated;

-- ── 5. UPDATE APPROVAL TRIGGER ───────────────────────────────────────────────
-- The existing trigger deducts stock at approval for ALL orders.
-- Now that checkout orders pre-reserve via reserve_inventory(), we must NOT
-- double-deduct at approval for those orders (status=pending_customer_payment).
-- Manual/agent orders start at 'agent_approval_pending' and still need deduction.
CREATE OR REPLACE FUNCTION deduct_inventory_on_order_approval()
RETURNS TRIGGER AS $$
DECLARE
  item                    RECORD;
  is_status_transition    BOOLEAN := FALSE;
  is_cancelled_transition BOOLEAN := FALSE;
  needs_deduction         BOOLEAN := FALSE;
  current_inventory       INT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.status IN ('pending_customer_payment', 'agent_approval_pending')) AND
       (NEW.status IN ('approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered'))
    THEN
      is_status_transition := TRUE;
      -- Only deduct if NOT pre-reserved: manual/agent orders use agent_approval_pending.
      needs_deduction := (OLD.status = 'agent_approval_pending');
    END IF;

    IF (OLD.status IN ('approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered')) AND
       (NEW.status = 'cancelled')
    THEN
      is_cancelled_transition := TRUE;
    END IF;

    -- Cancellation of a checkout order before approval: restore pre-reserved stock.
    IF (OLD.status = 'pending_customer_payment') AND (NEW.status = 'cancelled') THEN
      is_cancelled_transition := TRUE;
    END IF;
  END IF;

  IF is_status_transition AND needs_deduction THEN
    FOR item IN
      SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT inventory_count INTO current_inventory
        FROM public.products WHERE id = item.product_id FOR UPDATE;

        IF current_inventory < item.quantity THEN
          RAISE EXCEPTION 'Insufficient stock for product. Only % remaining, but % requested.',
            current_inventory, item.quantity;
        END IF;

        UPDATE public.products
        SET inventory_count = inventory_count - item.quantity
        WHERE id = item.product_id;
      END IF;
    END LOOP;
  END IF;

  IF is_cancelled_transition THEN
    FOR item IN
      SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        UPDATE public.products
        SET inventory_count = inventory_count + item.quantity
        WHERE id = item.product_id;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_deduct_inventory_on_approval ON public.orders;
CREATE TRIGGER trg_deduct_inventory_on_approval
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION deduct_inventory_on_order_approval();

-- ── 6. EXTEND store_credits TYPE CHECK ───────────────────────────────────────
-- Add 'release' type for compensating credit restorations when order creation
-- fails after the credit was pre-deducted.
ALTER TABLE public.store_credits
  DROP CONSTRAINT IF EXISTS store_credits_type_check;
ALTER TABLE public.store_credits
  ADD CONSTRAINT store_credits_type_check
  CHECK (type IN ('issue','redeem','expire','adjustment','release'));

-- ── 7. OPEN ANON INSERT ON agent_storefront_events ───────────────────────────
-- The existing `WITH CHECK (true)` policy allows any unauthenticated user to
-- insert telemetry rows with arbitrary agent_id, poisoning analytics dashboards.
-- Tighten to require authentication AND that agent_slug maps to a real agent.
DROP POLICY IF EXISTS "Anyone can insert storefront events" ON public.agent_storefront_events;

CREATE POLICY "Authenticated users can insert storefront events"
  ON public.agent_storefront_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id IN (
      SELECT id FROM public.agent_profiles WHERE is_active = true
    )
  );

-- ── 8. RMA ITEMS POLICY — REQUIRE AUTH CHAIN ──────────────────────────────────
-- The existing SELECT policy only checks EXISTS(rma_requests.id = rma_items.rma_id)
-- without verifying the caller is actually the buyer, agent, or admin. Any
-- authenticated user who guesses/knows an rma_id can read all its items.
DROP POLICY IF EXISTS "RMA items follow parent" ON public.rma_items;

CREATE POLICY "RMA items follow parent rma access"
  ON public.rma_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rma_requests r
      WHERE r.id = rma_items.rma_id
        AND (
          r.requester_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = r.order_id
              AND (o.buyer_id = auth.uid() OR o.agent_id = auth.uid())
          )
          OR public.is_admin()
        )
    )
  );
