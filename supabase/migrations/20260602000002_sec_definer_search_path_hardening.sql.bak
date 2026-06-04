-- ============================================================
-- Sweep 16: Security hardening — SECURITY DEFINER search_path
-- ============================================================
-- deduct_inventory_on_order_approval() was defined in checkout_atomicity
-- (migration 20260602000001) without the 'public.' schema prefix and without
-- SET search_path = public. This leaves it vulnerable to search-path
-- injection (a malicious user in a different schema could shadow functions
-- used inside the trigger). This migration recreates it with both guards.
--
-- All other SECURITY DEFINER functions were already fixed in:
--   20260528100000_audit_p0_hardening.sql
--   20260528150001_revoke_trigger_only_execute.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.deduct_inventory_on_order_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Re-point the trigger at the schema-qualified version.
DROP TRIGGER IF EXISTS trg_deduct_inventory_on_approval ON public.orders;
CREATE TRIGGER trg_deduct_inventory_on_approval
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_inventory_on_order_approval();

-- Lock down execute permission (trigger-only function, not callable by users).
REVOKE EXECUTE ON FUNCTION public.deduct_inventory_on_order_approval() FROM PUBLIC, anon, authenticated;
