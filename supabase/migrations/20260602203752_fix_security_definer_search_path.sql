CREATE OR REPLACE FUNCTION public.deduct_inventory_on_order_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      -- Only deduct if NOT pre-reserved: manual/agent orders use agent_approval_pending.
      -- Checkout orders (pending_customer_payment) were already reserved at checkout.
      needs_deduction := (OLD.status = 'agent_approval_pending');
    END IF;

    IF (OLD.status IN ('admin_approval_pending', 'approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered')) AND
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
$function$;

CREATE OR REPLACE FUNCTION public.fn_messenger_support_open(p_user_id uuid, p_topic text DEFAULT NULL::text, p_order_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id   uuid;
  v_conv_id    uuid;
  v_topic_clean text;
BEGIN
  SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1;
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'No admin available for support routing'; END IF;

  v_topic_clean := NULLIF(trim(coalesce(p_topic, '')), '');

  SELECT c.id INTO v_conv_id
    FROM public.messenger_conversations c
   WHERE c.is_support = true
     AND EXISTS (SELECT 1 FROM public.messenger_participants p WHERE p.conversation_id = c.id AND p.user_id = p_user_id)
     AND EXISTS (SELECT 1 FROM public.messenger_participants p WHERE p.conversation_id = c.id AND p.user_id = v_admin_id)
   ORDER BY c.created_at ASC LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    IF v_topic_clean IS NOT NULL THEN
      UPDATE public.messenger_conversations SET support_topic = v_topic_clean
       WHERE id = v_conv_id AND support_topic IS NULL;
    END IF;
    IF p_order_id IS NOT NULL THEN
      UPDATE public.messenger_conversations SET support_order_id = p_order_id
       WHERE id = v_conv_id AND support_order_id IS NULL;
    END IF;
    RETURN v_conv_id;
  END IF;

  INSERT INTO public.messenger_conversations
    (type, is_support, title, created_by, support_status, support_topic, support_order_id)
  VALUES
    ('direct', true, COALESCE(v_topic_clean, 'Pep Nation Support'),
     p_user_id, 'open', v_topic_clean, p_order_id)
  RETURNING id INTO v_conv_id;

  INSERT INTO public.messenger_participants (conversation_id, user_id, role)
  VALUES (v_conv_id, p_user_id, 'member'), (v_conv_id, v_admin_id, 'member')
  ON CONFLICT DO NOTHING;

  -- AUTO-ACK message insertion was removed here so it doesn't fire prematurely.
  -- It will be fired when the user sends their first message instead.

  RETURN v_conv_id;
END;
$function$;
