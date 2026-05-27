-- ============================================
-- PEP NATION LAB — Strict Inventory Deduction
-- Migration: 20260528000003_strict_inventory
-- ============================================

CREATE OR REPLACE FUNCTION deduct_inventory_on_order_approval()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  is_status_transition BOOLEAN := FALSE;
  is_cancelled_transition BOOLEAN := FALSE;
  current_inventory INT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Check if transitioning from pending to approved states
    IF (OLD.status = 'pending_customer_payment' OR OLD.status = 'agent_approval_pending') AND 
       (NEW.status IN ('approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered')) THEN
      is_status_transition := TRUE;
    END IF;
    
    -- Check if transitioning to cancelled from approved states
    IF (OLD.status IN ('approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered')) AND 
       (NEW.status = 'cancelled') THEN
      is_cancelled_transition := TRUE;
    END IF;
  END IF;

  IF is_status_transition THEN
    FOR item IN 
      SELECT product_id, quantity 
      FROM public.order_items 
      WHERE order_id = NEW.id 
    LOOP
      IF item.product_id IS NOT NULL THEN
        
        -- Lock the product row and get current inventory
        SELECT inventory_count INTO current_inventory 
        FROM public.products 
        WHERE id = item.product_id 
        FOR UPDATE;

        IF current_inventory < item.quantity THEN
           RAISE EXCEPTION 'Insufficient stock for product. Only % remaining, but % requested.', current_inventory, item.quantity;
        END IF;

        UPDATE public.products 
        SET inventory_count = inventory_count - item.quantity
        WHERE id = item.product_id;
        
      END IF;
    END LOOP;
  END IF;
  
  IF is_cancelled_transition THEN
    FOR item IN 
      SELECT product_id, quantity 
      FROM public.order_items 
      WHERE order_id = NEW.id 
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
