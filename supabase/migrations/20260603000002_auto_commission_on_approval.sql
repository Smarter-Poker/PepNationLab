-- ============================================================
-- Sweep 17: Auto-create commission rows on order approval
-- ============================================================
-- CRITICAL GAP: agent_commissions has order_id, commission_rate,
-- commission_amount columns — but NOTHING ever inserts into it when
-- an order is approved. Neither the admin single-PATCH, admin bulk
-- endpoint, nor any existing DB trigger creates these rows.
--
-- Admins could manually create payouts but had zero per-order audit
-- trail. This trigger fires AFTER an orders row transitions from any
-- pending state → approved_ship | approved_pickup and inserts a
-- commission row using the agent's profiles.commission_rate.
--
-- Design decisions:
--  • ON CONFLICT (order_id) DO NOTHING  — idempotent if re-triggered
--  • Skips self-buy orders (agent_id = buyer_id)
--  • commission_amount = ROUND(subtotal × rate / 100, 2)
--  • subtotal uses the orders.subtotal column (before tax+shipping)
--  • SECURITY DEFINER + SET search_path = public
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_create_commission_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate      NUMERIC;
  v_subtotal  NUMERIC;
  v_amount    NUMERIC;
BEGIN
  -- Only fire when transitioning INTO an approved state.
  IF NOT (
    OLD.status NOT IN ('approved_ship', 'approved_pickup') AND
    NEW.status IN ('approved_ship', 'approved_pickup')
  ) THEN
    RETURN NEW;
  END IF;

  -- Skip self-buy orders (agents buying for themselves).
  IF NEW.agent_id = NEW.buyer_id THEN
    RETURN NEW;
  END IF;

  -- Fetch the agent's commission rate (default 15 if null).
  SELECT COALESCE(commission_rate, 15)
    INTO v_rate
    FROM public.profiles
   WHERE id = NEW.agent_id;

  -- Subtotal on the order (excludes tax + shipping).
  v_subtotal := COALESCE(NEW.subtotal, 0);

  -- Calculate commission amount.
  v_amount := ROUND(v_subtotal * v_rate / 100.0, 2);

  -- Insert commission row — idempotent via ON CONFLICT.
  INSERT INTO public.agent_commissions (
    agent_id,
    order_id,
    commission_rate,
    order_subtotal,
    commission_amount,
    status
  )
  VALUES (
    NEW.agent_id,
    NEW.id,
    v_rate,
    v_subtotal,
    v_amount,
    'pending'
  )
  ON CONFLICT (order_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Revoke public access — only the DB engine fires this trigger.
REVOKE EXECUTE ON FUNCTION public.fn_create_commission_on_approval() FROM PUBLIC, anon, authenticated;

-- Drop and recreate trigger so reruns are safe.
DROP TRIGGER IF EXISTS trg_create_commission_on_approval ON public.orders;

CREATE TRIGGER trg_create_commission_on_approval
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_create_commission_on_approval();

-- ── Backfill: create commission rows for already-approved orders ──────────────
-- Any order currently in approved/shipped/delivered that has no commission row.
-- We use a DO block so errors in individual rows don't fail the whole migration.
DO $$
DECLARE
  r RECORD;
  v_rate     NUMERIC;
  v_subtotal NUMERIC;
  v_amount   NUMERIC;
BEGIN
  FOR r IN
    SELECT o.id, o.agent_id, o.buyer_id, o.subtotal, o.status
      FROM public.orders o
     WHERE o.status IN ('approved_ship','approved_pickup','in_fulfillment','shipped','delivered')
       AND o.agent_id <> o.buyer_id
       AND NOT EXISTS (
         SELECT 1 FROM public.agent_commissions ac WHERE ac.order_id = o.id
       )
  LOOP
    SELECT COALESCE(commission_rate, 15)
      INTO v_rate
      FROM public.profiles
     WHERE id = r.agent_id;

    v_subtotal := COALESCE(r.subtotal, 0);
    v_amount   := ROUND(v_subtotal * v_rate / 100.0, 2);

    INSERT INTO public.agent_commissions (
      agent_id, order_id, commission_rate, order_subtotal, commission_amount, status
    )
    VALUES (
      r.agent_id, r.id, v_rate, v_subtotal, v_amount, 'pending'
    )
    ON CONFLICT (order_id) DO NOTHING;
  END LOOP;
END;
$$;
