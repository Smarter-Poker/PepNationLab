-- Phase 2: Orders / E-Commerce Fixes

-- 1. Fix inventory bypass on order cancellation
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS fulfilled_locally BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Fix the trigger to use the new fulfilled_locally column
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
       (NEW.status IN ('admin_approval_pending', 'approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered'))
    THEN
      is_status_transition := TRUE;
      needs_deduction := (OLD.status = 'agent_approval_pending');
    END IF;

    IF (OLD.status IN ('admin_approval_pending', 'approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered')) AND
       (NEW.status = 'cancelled')
    THEN
      is_cancelled_transition := TRUE;
    END IF;

    IF (OLD.status = 'pending_customer_payment') AND (NEW.status = 'cancelled') THEN
      is_cancelled_transition := TRUE;
    END IF;
  END IF;

  IF is_status_transition AND needs_deduction THEN
    FOR item IN
      SELECT product_id, quantity, fulfilled_locally FROM public.order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NEW.agent_id IS NOT NULL AND NEW.fulfillment_method = 'ship' AND item.fulfilled_locally = TRUE THEN
          SELECT stock_count INTO current_inventory
          FROM public.agent_inventory WHERE product_id = item.product_id AND agent_id = NEW.agent_id FOR UPDATE;

          IF current_inventory < item.quantity THEN
            RAISE EXCEPTION 'Insufficient agent stock for product. Only % remaining, but % requested.',
              current_inventory, item.quantity;
          END IF;

          UPDATE public.agent_inventory
          SET stock_count = stock_count - item.quantity
          WHERE product_id = item.product_id AND agent_id = NEW.agent_id;
        ELSE
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
      END IF;
    END LOOP;
  END IF;

  IF is_cancelled_transition THEN
    FOR item IN
      SELECT product_id, quantity, fulfilled_locally FROM public.order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NEW.agent_id IS NOT NULL AND NEW.fulfillment_method = 'ship' AND item.fulfilled_locally = TRUE THEN
          UPDATE public.agent_inventory
          SET stock_count = stock_count + item.quantity
          WHERE product_id = item.product_id AND agent_id = NEW.agent_id;
        ELSE
          UPDATE public.products
          SET inventory_count = inventory_count + item.quantity
          WHERE id = item.product_id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.deduct_inventory_on_order_approval() FROM PUBLIC, anon, authenticated;

-- 3. Create missing charge_order_credit_line function
DROP FUNCTION IF EXISTS public.charge_order_credit_line(uuid, uuid);

CREATE OR REPLACE FUNCTION public.charge_order_credit_line(p_order_id uuid, p_created_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
BEGIN
  -- Lock order to prevent concurrent duplicate charges
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  -- Only applies if the order belongs to an agent
  IF v_order.agent_id IS NULL THEN
    RETURN;
  END IF;

  -- Verify it has not already been charged
  IF EXISTS (
    SELECT 1 FROM public.balance_transactions 
    WHERE reference_id = p_order_id AND type = 'order_charge'
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_order.agent_id FOR UPDATE;

  -- Only charge credit line for 'credit' account types
  IF v_profile.account_type IS DISTINCT FROM 'credit' THEN
    RETURN;
  END IF;

  IF COALESCE(v_profile.credit_used, 0) + v_order.total > COALESCE(v_profile.credit_limit, 0) THEN
    RAISE EXCEPTION 'Insufficient credit line limit. Required: %, Available: %', 
      v_order.total, 
      COALESCE(v_profile.credit_limit, 0) - COALESCE(v_profile.credit_used, 0);
  END IF;

  UPDATE public.profiles
  SET credit_used = COALESCE(credit_used, 0) + v_order.total,
      updated_at = NOW()
  WHERE id = v_order.agent_id;

  INSERT INTO public.balance_transactions
    (agent_id, type, amount, description, reference_id, reference_type, created_by)
  VALUES
    (v_order.agent_id, 'order_charge', v_order.total, 
     'Credit Charge For Order ' || left(p_order_id::text, 8),
     p_order_id, 'order', p_created_by);

END;
$function$;

REVOKE EXECUTE ON FUNCTION public.charge_order_credit_line(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charge_order_credit_line(uuid, uuid) TO authenticated, service_role;
