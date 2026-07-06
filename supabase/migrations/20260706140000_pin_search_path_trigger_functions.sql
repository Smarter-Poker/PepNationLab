-- ============================================================================
-- Security hardening: pin search_path on SECURITY DEFINER trigger functions
-- (2026-07-06)
-- ============================================================================
-- Background: Several SECURITY DEFINER trigger functions were created without
-- a fixed SET search_path clause. Without it, an unprivileged caller could
-- potentially hijack unqualified identifier resolution inside a definer-rights
-- context (function_search_path_mutable advisor warning). This migration
-- patches the three known trigger functions that lacked the pin:
--
--   1. public.deduct_inventory_on_order_approval() -- defined in multiple
--      migrations; the latest version is in 20260701160000. We re-create it
--      here with search_path pinned.
--
--   2. public.fn_audit_agent_product_price() -- from 20260701104400, audit
--      trigger on agent_products price changes.
--
--   3. public.handle_new_user() -- from 20260606030000, runs on auth.users
--      INSERT to create an initial profiles row.
--
-- These are all TRIGGER functions, so they cannot be called by external
-- users directly. The fix is additive and does not alter any logic.
-- ============================================================================

-- 1. deduct_inventory_on_order_approval
-- The canonical latest version is in 20260701160000_audit_phase2_ecommerce.sql.
-- Re-create it here with search_path pinned. Logic is identical.
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_order_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
$$;

REVOKE EXECUTE ON FUNCTION public.deduct_inventory_on_order_approval() FROM PUBLIC, anon, authenticated;

-- 2. fn_audit_agent_product_price
CREATE OR REPLACE FUNCTION public.fn_audit_agent_product_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If nothing changed, skip
  IF (OLD.retail_price = NEW.retail_price AND OLD.margin_percent = NEW.margin_percent) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.price_audit_logs (
    agent_id, product_id, old_retail_price, new_retail_price, old_margin_percent, new_margin_percent, reason
  ) VALUES (
    NEW.agent_id, NEW.product_id, OLD.retail_price, NEW.retail_price, OLD.margin_percent, NEW.margin_percent, 'System Update'
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_audit_agent_product_price() FROM PUBLIC, anon, authenticated;

-- 3. handle_new_user
-- This trigger runs in the auth schema context (on auth.users INSERT).
-- Pins search_path to public so profiles INSERT resolves correctly.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_full_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_first_name := split_part(v_full_name, ' ', 1);
  IF strpos(v_full_name, ' ') > 0 THEN
    v_last_name := substr(v_full_name, strpos(v_full_name, ' ') + 1);
  ELSE
    v_last_name := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, role)
  VALUES (
    NEW.id,
    CASE WHEN NEW.email LIKE '%@internal.auth' THEN NULL ELSE NEW.email END,
    v_full_name,
    v_first_name,
    v_last_name,
    'researcher'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- handle_new_user is invoked by the auth trigger set up in earlier migrations.
-- Grants are not applicable for trigger functions (they run as the definer).
