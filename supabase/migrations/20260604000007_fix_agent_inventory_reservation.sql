-- Drop the old functions that only take JSONB
DROP FUNCTION IF EXISTS public.reserve_inventory(JSONB);
DROP FUNCTION IF EXISTS public.release_inventory(JSONB);

CREATE OR REPLACE FUNCTION public.reserve_inventory(
  p_items JSONB,
  p_agent_id UUID DEFAULT NULL,
  p_is_agent_ship BOOLEAN DEFAULT FALSE
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item    RECORD;
  v_product RECORD;
  v_agent_stock INT;
BEGIN
  FOR v_item IN
    SELECT
      (elem->>'product_id')::UUID  AS product_id,
      (elem->>'quantity')::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) AS elem
    ORDER BY (elem->>'product_id')
  LOOP
    IF p_agent_id IS NOT NULL AND p_is_agent_ship THEN
      -- Agent local inventory deduction
      SELECT stock_count INTO v_agent_stock
      FROM public.agent_inventory
      WHERE product_id = v_item.product_id AND agent_id = p_agent_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Agent inventory record not found for product %', v_item.product_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF v_agent_stock < v_item.quantity THEN
        RAISE EXCEPTION 'Insufficient agent inventory. Only % in stock, % requested.',
          v_agent_stock, v_item.quantity
          USING ERRCODE = 'check_violation';
      END IF;

      UPDATE public.agent_inventory
      SET stock_count = stock_count - v_item.quantity
      WHERE product_id = v_item.product_id AND agent_id = p_agent_id;

    ELSE
      -- Global inventory deduction
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
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_inventory(JSONB, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_inventory(JSONB, UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_inventory(
  p_items JSONB,
  p_agent_id UUID DEFAULT NULL,
  p_is_agent_ship BOOLEAN DEFAULT FALSE
)
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
    IF p_agent_id IS NOT NULL AND p_is_agent_ship THEN
      UPDATE public.agent_inventory
      SET stock_count = stock_count + v_item.quantity
      WHERE product_id = v_item.product_id AND agent_id = p_agent_id;
    ELSE
      UPDATE public.products
      SET inventory_count = inventory_count + v_item.quantity,
          updated_at = NOW()
      WHERE id = v_item.product_id;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_inventory(JSONB, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_inventory(JSONB, UUID, BOOLEAN) TO authenticated;

-- Update the approval trigger to handle agent vs global correctly based on NEW.fulfillment_method
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
        -- If agent_id is set AND it's a ship order, deduct from agent_inventory.
        IF NEW.agent_id IS NOT NULL AND NEW.fulfillment_method = 'ship' THEN
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
      SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NEW.agent_id IS NOT NULL AND NEW.fulfillment_method = 'ship' THEN
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
