-- Allow admins to bypass the insufficient stock constraint when force approving an order

CREATE OR REPLACE FUNCTION public.deduct_inventory_on_order_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  item                    RECORD;
  is_status_transition    BOOLEAN := FALSE;
  is_cancelled_transition BOOLEAN := FALSE;
  needs_deduction         BOOLEAN := FALSE;
  cancelled_pre_approval  BOOLEAN := FALSE;
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

    IF (OLD.status IN ('pending_customer_payment', 'agent_approval_pending')) AND (NEW.status = 'cancelled') THEN
      is_cancelled_transition := TRUE;
      cancelled_pre_approval := TRUE;
    END IF;
  END IF;

  IF is_status_transition AND needs_deduction THEN
    FOR item IN
      SELECT product_id, quantity, fulfilled_locally FROM public.order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NEW.agent_id IS NOT NULL AND NEW.fulfillment_method = 'ship' AND item.fulfilled_locally = TRUE THEN
          IF COALESCE(NEW.inventory_reserved, FALSE) THEN
            CONTINUE;
          END IF;

          SELECT stock_count INTO current_inventory
          FROM public.agent_inventory WHERE product_id = item.product_id AND agent_id = NEW.agent_id FOR UPDATE;

          IF current_inventory < item.quantity AND current_setting('pepnation.admin_override', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'Insufficient agent stock for product. Only % remaining, but % requested.',
              current_inventory, item.quantity;
          END IF;

          UPDATE public.agent_inventory
          SET stock_count = stock_count - item.quantity
          WHERE product_id = item.product_id AND agent_id = NEW.agent_id;
        ELSE
          SELECT inventory_count INTO current_inventory
          FROM public.products WHERE id = item.product_id FOR UPDATE;

          IF current_inventory < item.quantity AND current_setting('pepnation.admin_override', true) IS DISTINCT FROM 'true' THEN
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
          IF cancelled_pre_approval AND NOT COALESCE(NEW.inventory_reserved, FALSE) THEN
            CONTINUE;
          END IF;

          UPDATE public.agent_inventory
          SET stock_count = stock_count + item.quantity
          WHERE product_id = item.product_id AND agent_id = NEW.agent_id;
        ELSE
          IF cancelled_pre_approval THEN
            CONTINUE;
          END IF;

          UPDATE public.products
          SET inventory_count = inventory_count + item.quantity
          WHERE id = item.product_id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_force_update_order(
  p_order_id UUID,
  p_current_status text,
  p_status text,
  p_tracking_number text DEFAULT NULL,
  p_agent_approval_notes text DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated_id UUID;
BEGIN
  -- Signal the inventory triggers that this is a forced admin override
  PERFORM set_config('pepnation.admin_override', 'true', true);

  UPDATE public.orders
  SET status = p_status::public.order_status,
      tracking_number = COALESCE(p_tracking_number, tracking_number),
      agent_approval_notes = COALESCE(p_agent_approval_notes, agent_approval_notes),
      agent_approved_at = CASE WHEN p_status IN ('approved_ship', 'approved_pickup') AND status NOT IN ('approved_ship', 'approved_pickup') THEN now() ELSE agent_approved_at END,
      updated_at = now()
  WHERE id = p_order_id AND status = p_current_status::public.order_status
  RETURNING id INTO v_updated_id;

  RETURN v_updated_id IS NOT NULL;
END;
$$;
