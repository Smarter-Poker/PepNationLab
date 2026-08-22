-- Atomic super-agent chain credit gate (closes the H9 TOCTOU).
--
-- The application pre-check (checkSuperAgentCredit in app/api/orders/route.ts)
-- sums the super-agent chain's outstanding exposure in JavaScript across
-- separate Supabase calls, then inserts the order in a LATER call -- so two
-- concurrent checkouts can both pass and collectively exceed the limit.
--
-- This function is called AFTER the order is inserted in an approved state.
-- It locks the super-agent's profile row (FOR UPDATE), so concurrent chain
-- approvals serialize: the second caller waits, then sees the first order's
-- committed exposure. If the projection exceeds the credit limit it atomically
-- demotes THIS order back to agent_approval_pending (the same status the route
-- already uses when charge_order_credit_line fails), so nothing ships unbilled.
--
-- The route passes p_super_agent_id and p_amount (this order's chain COGS),
-- both already computed by the existing, correct JS. The only logic re-expressed
-- here is the historical in-flight sum, which mirrors checkSuperAgentCredit
-- exactly: pending_payment weekly statements + COGS of approved, non-restock,
-- unbilled orders across the chain (super-agent + its sub-agents), using the
-- super-agent cost for sub-agent orders (fallback to agent cost), clamped >= 0,
-- plus shipping. THIS order is excluded from the sum (o.id <> p_order_id)
-- because its exposure is supplied as p_amount.
--
-- Validated 2026-07-12 against the live DB: synthetic formula match (6 cases,
-- cent-exact vs the JS) + a self-rolling-back e2e (under-limit pass, over-limit
-- demote to agent_approval_pending).
CREATE OR REPLACE FUNCTION public.gate_order_chain_credit(
  p_order_id uuid,
  p_super_agent_id uuid,
  p_amount numeric
)
RETURNS TABLE(ok boolean, projected numeric, credit_limit numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_super public.profiles%ROWTYPE;
  v_unbilled numeric := 0;
  v_inflight numeric := 0;
  v_limit numeric;
  v_projected numeric;
BEGIN
  -- No super-agent chain or no amount -> nothing to gate here (the direct-agent
  -- charge_order_credit_line still enforces the direct agent's own limit).
  IF p_super_agent_id IS NULL OR p_amount IS NULL THEN
    RETURN QUERY SELECT true, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  -- Serialize concurrent approvals for this chain on the super-agent row.
  SELECT * INTO v_super FROM public.profiles WHERE id = p_super_agent_id FOR UPDATE;
  IF NOT FOUND OR v_super.account_type IS DISTINCT FROM 'credit' THEN
    RETURN QUERY SELECT true, 0::numeric, 0::numeric;
    RETURN;
  END IF;
  v_limit := COALESCE(v_super.credit_limit, 0);

  -- currentUnbilled: pending_payment weekly statements for the super-agent.
  SELECT COALESCE(SUM(total_owed), 0) INTO v_unbilled
  FROM public.weekly_statements
  WHERE agent_id = p_super_agent_id AND status = 'pending_payment';

  -- inFlight: approved, non-restock, unbilled orders across the chain,
  -- excluding THIS order (supplied as p_amount).
  SELECT COALESCE(SUM(order_cost), 0) INTO v_inflight
  FROM (
    SELECT
      COALESCE(o.shipping_cost, 0) + COALESCE((
        SELECT SUM(
          GREATEST(0,
            CASE
              WHEN o.agent_id <> p_super_agent_id THEN
                CASE
                  WHEN oi.unit_super_agent_cost IS NOT NULL AND oi.unit_super_agent_cost > 0
                    THEN oi.unit_super_agent_cost
                  ELSE COALESCE(oi.unit_cost_price, 0)
                END
              ELSE COALESCE(oi.unit_cost_price, 0)
            END
          ) * COALESCE(oi.quantity, 0)
        )
        FROM public.order_items oi
        WHERE oi.order_id = o.id
      ), 0) AS order_cost
    FROM public.orders o
    WHERE o.agent_id IN (
        SELECT id FROM public.profiles
        WHERE id = p_super_agent_id OR parent_agent_id = p_super_agent_id
      )
      AND COALESCE(o.is_wholesale_restock, false) = false
      AND o.status IN ('approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered')
      AND o.id <> p_order_id
      AND NOT EXISTS (SELECT 1 FROM public.statement_orders so WHERE so.order_id = o.id)
  ) chain_orders;

  v_projected := v_unbilled + v_inflight + p_amount;

  IF v_projected > v_limit THEN
    -- Over the chain limit. Demote this order so it cannot ship unbilled; a human
    -- approves it after the chain settles. Guarded on the approved statuses so a
    -- concurrent transition is never clobbered.
    UPDATE public.orders
    SET status = 'agent_approval_pending'
    WHERE id = p_order_id AND status IN ('approved_ship', 'approved_pickup');
    RETURN QUERY SELECT false, v_projected, v_limit;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_projected, v_limit;
END;
$function$;