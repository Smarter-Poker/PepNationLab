-- ============================================================================
-- DB Performance And Concurrency Hardening -- SENTINEL Sweep 2026-07-11
-- Findings source: six-agent database performance audit (query analysis,
-- client usage, indexing, critical-path tracing, concurrency, caching),
-- cross-verified against live pg_stat and Supabase performance advisors.
--
-- Sections:
--   1. Missing indexes (live-advisor-confirmed unindexed FKs + hot-path
--      composites) and one duplicate index drop
--   2. RLS initplan: wrap is_admin() / is_agent_or_above() and stray bare
--      auth.uid() calls in scalar subqueries so they evaluate once per
--      statement instead of once per row (106 policies affected)
--   3. Duplicate permissive policy cleanup (reserved_slugs had two identical
--      public SELECT policies)
--   4. Inventory trigger: status-aware cancel restore. Fixes two defects:
--      (a) agent_approval_pending -> cancelled restored nothing, leaking
--          reserved agent-local stock forever;
--      (b) pre-approval cancels restored products.inventory_count that was
--          never deducted (global stock is only deducted at the
--          agent_approval_pending -> approved transition), inflating global
--          stock on every stale-order sweep.
--   5. refund_prepaid_balance: write a balance_transactions ledger row so
--      automatic rollbacks no longer silently diverge the ledger from the
--      balance.
--   6. cancel_stale_pending_orders: restore burned coupon slots on sweep,
--      matching cancel_order() semantics.
--   7. admin_adjust_balance: atomic admin balance adjustment RPC (row lock +
--      relative update + ledger insert in one transaction) to replace the
--      read-then-absolute-write in /api/admin/transactions that could erase
--      concurrent deductions.
-- ============================================================================

-- ─── Section 1: Indexes ──────────────────────────────────────────────────────

-- Hot auth-path equality lookups (request-code, reset-password, verify-email,
-- storefront register, invitations). Only a trgm GIN existed before.
CREATE INDEX IF NOT EXISTS idx_profiles_email
  ON public.profiles (email);

-- Unindexed FK (added 2026-07-11, after both FK index sweeps).
CREATE INDEX IF NOT EXISTS idx_product_alerts_agent_id
  ON public.product_alerts (agent_id);

-- FK enforcement cannot use the existing partial (status='active') index.
CREATE INDEX IF NOT EXISTS idx_product_alerts_product_id_all
  ON public.product_alerts (product_id);

-- Unindexed FK on an append-heavy telemetry table.
CREATE INDEX IF NOT EXISTS idx_web_vitals_user_id
  ON public.web_vitals (user_id)
  WHERE user_id IS NOT NULL;

-- Unindexed FK (added 2026-07-12, after both FK index sweeps).
CREATE INDEX IF NOT EXISTS idx_referral_promotions_created_by
  ON public.referral_promotions (created_by);

-- Researcher order history: .eq(buyer_id).order(created_at desc).
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created
  ON public.orders (buyer_id, created_at DESC);

-- Admin orders list: status filter + created_at DESC sort.
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders (status, created_at DESC);

-- Agent ledger views: .eq(agent_id).order(created_at desc).
CREATE INDEX IF NOT EXISTS idx_balance_tx_agent_created
  ON public.balance_transactions (agent_id, created_at DESC);

-- Inbox reads fetch read AND unread messages; only the unread partial had
-- the composite shape.
CREATE INDEX IF NOT EXISTS idx_internal_messages_inbox
  ON public.internal_messages (receiver_id, created_at DESC);

-- Advisor-confirmed exact duplicate of slug_res_expires_idx.
DROP INDEX IF EXISTS public.idx_slug_reservations_cleanup;

-- ─── Section 2: RLS Initplan Fixes ───────────────────────────────────────────
-- Wrap bare is_admin() / is_agent_or_above() calls in scalar subqueries across
-- every policy in public. Mirrors the 20260707214307 auth.uid() sweep, which
-- did not cover these helper functions. Semantically identical; evaluated once
-- per statement instead of once per row.
DO $$
DECLARE
  r      RECORD;
  v_qual  TEXT;
  v_check TEXT;
  v_sql   TEXT;
BEGIN
  FOR r IN
    SELECT pol.polname,
           n.nspname,
           c.relname,
           pg_get_expr(pol.polqual, pol.polrelid)      AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
    FROM pg_policy pol
    JOIN pg_class c      ON c.oid = pol.polrelid
    JOIN pg_namespace n  ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (
        pg_get_expr(pol.polqual, pol.polrelid)      ~ '(^|[^0-9A-Za-z_.])is_(admin|agent_or_above)\(\)'
        OR
        pg_get_expr(pol.polwithcheck, pol.polrelid) ~ '(^|[^0-9A-Za-z_.])is_(admin|agent_or_above)\(\)'
      )
  LOOP
    -- Qualified forms first, then bare forms. The bare-form pass cannot touch
    -- the already-wrapped qualified replacements because those are preceded
    -- by a dot.
    v_qual := r.qual;
    IF v_qual IS NOT NULL THEN
      v_qual := regexp_replace(v_qual, '(^|[^0-9A-Za-z_])public\.is_admin\(\)',          '\1( SELECT public.is_admin() )', 'g');
      v_qual := regexp_replace(v_qual, '(^|[^0-9A-Za-z_])public\.is_agent_or_above\(\)', '\1( SELECT public.is_agent_or_above() )', 'g');
      v_qual := regexp_replace(v_qual, '(^|[^0-9A-Za-z_.])is_admin\(\)',                 '\1( SELECT public.is_admin() )', 'g');
      v_qual := regexp_replace(v_qual, '(^|[^0-9A-Za-z_.])is_agent_or_above\(\)',        '\1( SELECT public.is_agent_or_above() )', 'g');
    END IF;

    v_check := r.with_check;
    IF v_check IS NOT NULL THEN
      v_check := regexp_replace(v_check, '(^|[^0-9A-Za-z_])public\.is_admin\(\)',          '\1( SELECT public.is_admin() )', 'g');
      v_check := regexp_replace(v_check, '(^|[^0-9A-Za-z_])public\.is_agent_or_above\(\)', '\1( SELECT public.is_agent_or_above() )', 'g');
      v_check := regexp_replace(v_check, '(^|[^0-9A-Za-z_.])is_admin\(\)',                 '\1( SELECT public.is_admin() )', 'g');
      v_check := regexp_replace(v_check, '(^|[^0-9A-Za-z_.])is_agent_or_above\(\)',        '\1( SELECT public.is_agent_or_above() )', 'g');
    END IF;

    v_sql := format('ALTER POLICY %I ON %I.%I', r.polname, r.nspname, r.relname);
    IF v_qual  IS NOT NULL THEN v_sql := v_sql || format(' USING (%s)', v_qual);       END IF;
    IF v_check IS NOT NULL THEN v_sql := v_sql || format(' WITH CHECK (%s)', v_check); END IF;
    EXECUTE v_sql;
  END LOOP;
END $$;

-- Stragglers created after the 2026-07-07 auth.uid() sweep, still calling
-- auth.uid() per row.
ALTER POLICY "Authenticated read referral promotions" ON public.referral_promotions
  USING ((( SELECT auth.uid() ) IS NOT NULL));

ALTER POLICY "reserved_slugs_admin_all" ON public.reserved_slugs
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = ( SELECT auth.uid() )
      AND profiles.role = 'admin'::user_role
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = ( SELECT auth.uid() )
      AND profiles.role = 'admin'::user_role
  ));

-- ─── Section 3: Duplicate Permissive Policy Cleanup ─────────────────────────
-- reserved_slugs carried two identical public SELECT policies (both USING
-- true). Keep reserved_slugs_public_read, drop the duplicate.
DROP POLICY IF EXISTS "reserved_slugs_read_all" ON public.reserved_slugs;

-- ─── Section 4: Status-Aware Inventory Cancel Restore ───────────────────────
-- Inventory model recap (per 20260711000005 H10 and the current
-- reserve_inventory / release_inventory pair):
--   * reserve_inventory at checkout deducts agent_inventory for agent-local
--     ship lines ONLY; global/China lines are untouched at reservation time.
--   * The approval transition (agent_approval_pending -> approved states)
--     deducts products.inventory_count for global lines, and agent_inventory
--     for local lines of NON-reserved (manual) orders.
-- Therefore, on cancellation:
--   * Cancels from pre-approval statuses (pending_customer_payment,
--     agent_approval_pending) must restore ONLY the reserved local lines --
--     global stock was never deducted for these orders, and non-reserved
--     orders had nothing deducted at all.
--   * Cancels from post-approval statuses keep the existing full restore.
-- Previous behavior leaked reserved local stock on
-- agent_approval_pending -> cancelled and inflated global stock on
-- pending_customer_payment -> cancelled.
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
          -- Local stock was deducted at checkout only when the order was
          -- reserved; pre-approval cancels of non-reserved orders had no
          -- deduction, so restoring would create phantom stock.
          IF cancelled_pre_approval AND NOT COALESCE(NEW.inventory_reserved, FALSE) THEN
            CONTINUE;
          END IF;

          UPDATE public.agent_inventory
          SET stock_count = stock_count + item.quantity
          WHERE product_id = item.product_id AND agent_id = NEW.agent_id;
        ELSE
          -- Global stock is only deducted at the approval transition, which a
          -- pre-approval order never reached. Restoring here inflated
          -- products.inventory_count on every stale-order sweep.
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

-- ─── Section 5: Ledger Row On Prepaid Refunds ────────────────────────────────
-- Every deduct path writes a balance_transactions row; refunds wrote none, so
-- each automatic checkout rollback silently diverged the ledger from the
-- balance. Drop and recreate with optional reference params so existing
-- 2-argument callers keep working via defaults (a single function avoids
-- PostgREST overload ambiguity).
DROP FUNCTION IF EXISTS public.refund_prepaid_balance(uuid, numeric);

CREATE FUNCTION public.refund_prepaid_balance(
  p_agent_id     uuid,
  p_amount       numeric,
  p_reference_id uuid DEFAULT NULL,
  p_description  text DEFAULT 'Order Payment Refund (Automatic Rollback)'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_current NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RETURN FALSE;
  END IF;

  SELECT prepaid_balance INTO v_current
  FROM public.profiles
  WHERE id = p_agent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
  SET prepaid_balance = prepaid_balance + p_amount,
      updated_at = NOW()
  WHERE id = p_agent_id;

  INSERT INTO public.balance_transactions
    (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type)
  VALUES
    (p_agent_id, 'credit', p_amount, COALESCE(v_current, 0), COALESCE(v_current, 0) + p_amount,
     p_description, p_reference_id,
     CASE WHEN p_reference_id IS NULL THEN NULL ELSE 'order' END);

  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.refund_prepaid_balance(uuid, numeric, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_prepaid_balance(uuid, numeric, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.refund_prepaid_balance(uuid, numeric, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refund_prepaid_balance(uuid, numeric, uuid, text) TO service_role;

-- ─── Section 6: Coupon Slot Restore In The Stale-Order Sweeper ──────────────
-- cancel_order() restores the coupon redemption slot; the 72h auto-sweeper did
-- not, so every swept coupon order burned a max_uses slot forever.
CREATE OR REPLACE FUNCTION public.cancel_stale_pending_orders(p_hours integer DEFAULT 72)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count INT;
BEGIN
  WITH cancelled AS (
    UPDATE public.orders
    SET status = 'cancelled',
        updated_at = NOW(),
        agent_approval_notes = COALESCE(agent_approval_notes, '') ||
          ' [Auto-cancelled: payment not received within ' || p_hours || 'h]'
    WHERE status = 'pending_customer_payment'
      AND created_at < NOW() - (p_hours || ' hours')::INTERVAL
    RETURNING id, agent_id, coupon_code
  ),
  coupon_slots AS (
    SELECT agent_id, UPPER(coupon_code) AS code, COUNT(*) AS n
    FROM cancelled
    WHERE coupon_code IS NOT NULL AND agent_id IS NOT NULL
    GROUP BY agent_id, UPPER(coupon_code)
  ),
  restored AS (
    UPDATE public.coupons c
    SET uses_count = GREATEST(0, c.uses_count - s.n)
    FROM coupon_slots s
    WHERE c.agent_id = s.agent_id
      AND UPPER(c.code) = s.code
    RETURNING c.id
  )
  SELECT COUNT(*) INTO v_count FROM cancelled;
  RETURN v_count;
END;
$function$;

-- ─── Section 7: Atomic Admin Balance Adjustment ──────────────────────────────
-- Replaces the read-then-absolute-write in POST /api/admin/transactions, which
-- could erase a concurrent deduct_prepaid_balance (lost update) and could
-- change the balance without a ledger row on partial failure. Row lock,
-- relative update, and ledger insert in one transaction.
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_agent_id       uuid,
  p_type           text,
  p_amount         numeric,
  p_description    text,
  p_created_by     uuid,
  p_reference_id   uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL
)
RETURNS TABLE (transaction_id uuid, balance_before numeric, balance_after numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_before    NUMERIC;
  v_after     NUMERIC;
  v_direction INT;
  v_tx_id     UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be a positive number';
  END IF;

  -- Mirrors the route's CREDIT_TYPES list exactly.
  IF p_type IN ('credit', 'deposit', 'bonus', 'commission', 'adjustment', 'manual_adjustment') THEN
    v_direction := 1;
  ELSIF p_type IN ('withdrawal', 'order_charge', 'restock_charge', 'debit', 'payout') THEN
    v_direction := -1;
  ELSE
    RAISE EXCEPTION 'Invalid transaction type: %', p_type;
  END IF;

  SELECT prepaid_balance INTO v_before
  FROM public.profiles
  WHERE id = p_agent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent not found';
  END IF;

  v_before := COALESCE(v_before, 0);
  v_after  := v_before + v_direction * p_amount;

  UPDATE public.profiles
  SET prepaid_balance = v_after,
      updated_at = NOW()
  WHERE id = p_agent_id;

  INSERT INTO public.balance_transactions
    (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, created_by)
  VALUES
    (p_agent_id, p_type, p_amount, v_before, v_after, p_description, p_reference_id, p_reference_type, p_created_by)
  RETURNING id INTO v_tx_id;

  RETURN QUERY SELECT v_tx_id, v_before, v_after;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_adjust_balance(uuid, text, numeric, text, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_adjust_balance(uuid, text, numeric, text, uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_adjust_balance(uuid, text, numeric, text, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, text, numeric, text, uuid, uuid, text) TO service_role;
