-- Bug-Hunt 2026-07-11 remediation migration.
-- Addresses: C4 (profile column self-escalation), C5 (arbitrary order insert),
-- C6 (unguarded agent order update), H8 (anon reads of wholesale cost columns),
-- H10 (double inventory deduction on approval of pre-reserved agent-local orders).
--
-- All order-write paths (checkout, agent/orders/new, agent/orders/approve,
-- admin/orders/bulk, shippo webhook) use the service-role client, which bypasses
-- RLS, so removing the two direct-write order policies below changes no app path.

-- ─── C4: lock down financial / tier / attribution columns on profiles ─────────
-- These columns were not pinned by the protect_profile_columns trigger, so any
-- authenticated user could PATCH their own profile row via PostgREST to grant
-- themselves credit terms, auto-approval, cheaper pricing tiers, or reset their
-- own credit_used. Extend the existing authenticated-write pin-list.
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF current_setting('role', true) = 'authenticated' THEN
    NEW.role := OLD.role;
    NEW.credit_limit := OLD.credit_limit;
    NEW.prepaid_balance := OLD.prepaid_balance;
    NEW.auto_approve_orders := OLD.auto_approve_orders;
    NEW.tier := OLD.tier;
    NEW.is_active := OLD.is_active;
    NEW.is_super_agent := OLD.is_super_agent;
    NEW.parent_agent_id := OLD.parent_agent_id;
    NEW.is_sub_agent := OLD.is_sub_agent;
    NEW.commission_pct := OLD.commission_pct;
    NEW.referring_sub_agent_id := OLD.referring_sub_agent_id;
    -- Provisioned-account tracking columns: only service role / SECURITY DEFINER triggers may write
    NEW.created_by_agent_id := OLD.created_by_agent_id;
    NEW.created_by_role := OLD.created_by_role;
    NEW.first_sign_in_at := OLD.first_sign_in_at;
    NEW.last_sign_in_at := OLD.last_sign_in_at;
    NEW.sign_in_count := OLD.sign_in_count;
    NEW.account_activated_at := OLD.account_activated_at;
    -- Bug-Hunt 2026-07-11 (C4): financial / tier / attribution columns that were
    -- previously writable by any authenticated user. Pin them to their old value
    -- on any authenticated update; service role / SECURITY DEFINER paths (which
    -- run as a non-authenticated role) are unaffected and can still write them.
    NEW.account_type := OLD.account_type;
    NEW.max_auto_approve_limit := OLD.max_auto_approve_limit;
    NEW.credit_used := OLD.credit_used;
    NEW.referring_agent_id := OLD.referring_agent_id;
    NEW.custom_markup_override := OLD.custom_markup_override;
    NEW.locked_tier_level := OLD.locked_tier_level;
    NEW.house_tier_level := OLD.house_tier_level;
    NEW.velocity_cap := OLD.velocity_cap;
    NEW.fixed_scale_override := OLD.fixed_scale_override;
  END IF;
  RETURN NEW;
END;
$function$;

-- ─── C5: remove the direct order-insert policy ───────────────────────────────
-- Only ever let a logged-in user POST arbitrary orders (any status, any total)
-- straight to PostgREST, bypassing server-side pricing, disclaimer layer 4,
-- inventory reservation and credit checks. No app path relies on it.
DROP POLICY IF EXISTS "Buyers can create orders" ON public.orders;

-- ─── C6: remove the unguarded agent order-update policy ──────────────────────
-- Had no WITH CHECK and no column guard, so an agent could directly zero
-- subtotal/total/shipping_cost on their own orders before weekly billing read
-- them, or move status outside the app's transition map. Real updates run
-- through service-role routes.
DROP POLICY IF EXISTS "Agents can update their orders" ON public.orders;

-- ─── H8: stop anonymous reads of wholesale cost columns ──────────────────────
-- Guest storefront browsing reads agent_products (retail) via server code, and
-- every public storefront API route uses the service-role client (which bypasses
-- these grants), so no anonymous request reads public.products directly. A
-- column-level REVOKE is masked by anon's table-wide SELECT grant, so revoke anon
-- access to the base table entirely. This closes the wholesale-cost leak
-- (base_cost, admin_bulk_price, admin_bulk_threshold, inventory_count).
-- authenticated / service_role keep full access (server pricing depends on it).
REVOKE ALL ON public.products FROM anon;

-- ─── H10: stop double inventory deduction on approval ────────────────────────
-- reserve_inventory (run at checkout) decrements agent_inventory for agent-local
-- ship lines only; global/China stock is treated as infinite (no-op). The
-- approval trigger then decremented agent_inventory a SECOND time for those same
-- lines. Skip the agent-local deduction when the order was already reserved,
-- while still deducting products.inventory_count for global lines (which
-- reserve_inventory never touches) so finite global stock can never be oversold.
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
          -- Bug-Hunt 2026-07-11 (H10): when this order was already reserved at
          -- checkout, reserve_inventory has ALREADY decremented agent_inventory
          -- for this local line. Skip here to avoid deducting it twice.
          IF COALESCE(NEW.inventory_reserved, FALSE) THEN
            CONTINUE;
          END IF;

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
$function$;
