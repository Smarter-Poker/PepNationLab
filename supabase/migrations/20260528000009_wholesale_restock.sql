-- ============================================
-- PEP NATION LAB — Wholesale Restock Logic
-- Migration: 20260528000009_wholesale_restock
-- ============================================

-- 1. Add flag to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS is_wholesale_restock BOOLEAN DEFAULT FALSE;

-- 2. Update the inventory deduction trigger to handle restocks
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
        IF NEW.is_wholesale_restock = TRUE THEN
          -- Agent Wholesale Restock: Deduct from global, ADD to agent
          UPDATE public.products 
          SET inventory_count = GREATEST(0, inventory_count - item.quantity)
          WHERE id = item.product_id;

          -- Add to agent inventory (upsert pattern)
          INSERT INTO public.agent_inventory (agent_id, product_id, stock_count)
          VALUES (NEW.buyer_id, item.product_id, item.quantity)
          ON CONFLICT (agent_id, product_id)
          DO UPDATE SET stock_count = public.agent_inventory.stock_count + item.quantity;
          
        ELSIF NEW.agent_id IS NOT NULL THEN
          -- Standard Retail Order via Agent: Deduct from agent's inventory
          UPDATE public.agent_inventory 
          SET stock_count = GREATEST(0, stock_count - item.quantity)
          WHERE product_id = item.product_id AND agent_id = NEW.agent_id;
          
        ELSE
          -- Direct Retail Order without Agent: Deduct from global inventory
          UPDATE public.products 
          SET inventory_count = GREATEST(0, inventory_count - item.quantity)
          WHERE id = item.product_id;
        END IF;
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
        IF NEW.is_wholesale_restock = TRUE THEN
          -- Reverse Wholesale Restock: Refund global, SUBTRACT from agent
          UPDATE public.products 
          SET inventory_count = inventory_count + item.quantity
          WHERE id = item.product_id;

          UPDATE public.agent_inventory 
          SET stock_count = GREATEST(0, stock_count - item.quantity)
          WHERE product_id = item.product_id AND agent_id = NEW.buyer_id;

        ELSIF NEW.agent_id IS NOT NULL THEN
          -- Agent Order: Refund to agent's inventory
          UPDATE public.agent_inventory 
          SET stock_count = stock_count + item.quantity
          WHERE product_id = item.product_id AND agent_id = NEW.agent_id;
          
        ELSE
          -- Direct Retail Order: Refund to global inventory
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
