-- ============================================================
-- Sweep 18: Fix commission trigger NULL agent_id crash
-- ============================================================
-- When orders.agent_id IS NULL (direct PNL orders with no agent),
-- the trigger fn_create_commission_on_approval had three bugs:
--   1. NEW.agent_id = NEW.buyer_id evaluates to NULL, not TRUE,
--      so the self-buy guard did NOT skip — fell through.
--   2. SELECT ... WHERE id = NULL returns 0 rows, leaving v_rate
--      as uninitialized (plpgsql NUMERIC defaults to NULL, not 0).
--   3. INSERT agent_id = NULL → NOT NULL constraint violation,
--      causing the entire order approval PATCH to crash with 500.
--
-- Fix: add explicit IS NULL guard at the top of the trigger.
-- Also tighten the self-buy check to IS NOT DISTINCT FROM.
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

  -- Skip direct PNL orders (no agent assigned).
  IF NEW.agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip self-buy orders (agent buying for themselves).
  -- Use IS NOT DISTINCT FROM to handle NULL = NULL safely.
  IF NEW.agent_id IS NOT DISTINCT FROM NEW.buyer_id THEN
    RETURN NEW;
  END IF;

  -- Fetch the agent's commission rate (default 15 if null/missing).
  SELECT COALESCE(commission_rate, 15)
    INTO v_rate
    FROM public.profiles
   WHERE id = NEW.agent_id;

  -- If agent profile not found, default to 15%.
  IF v_rate IS NULL THEN
    v_rate := 15;
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.fn_create_commission_on_approval() FROM PUBLIC, anon, authenticated;
