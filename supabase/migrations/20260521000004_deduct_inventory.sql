-- ============================================
-- PEP NATION LAB — Inventory Deduction Trigger
-- Migration: 20260521000004_deduct_inventory
-- ============================================

CREATE OR REPLACE FUNCTION deduct_inventory_on_order_approval()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  is_status_transition BOOLEAN := FALSE;
  is_cancelled_transition BOOLEAN := FALSE;
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
        UPDATE public.products 
        SET inventory_count = GREATEST(0, inventory_count - item.quantity)
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

DROP TRIGGER IF EXISTS trg_deduct_inventory_on_approval ON public.orders;

CREATE TRIGGER trg_deduct_inventory_on_approval
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION deduct_inventory_on_order_approval();
