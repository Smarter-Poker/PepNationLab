-- Fold the atomic super-agent chain credit gate INTO charge_order_credit_line
-- (Bug-Hunt 2026-07-11 H9). The orders route + approve routes already call this
-- RPC on an approved order and already demote the order to agent_approval_pending
-- when it returns an error, so enforcing the chain limit here -- under the
-- super-agent's row lock -- closes the read-then-decide TOCTOU in the JS
-- pre-check (checkSuperAgentCredit) with NO application change and consistent
-- behavior across every approval path. Supersedes the standalone
-- gate_order_chain_credit() helper from 20260712190000 (dropped below).
CREATE OR REPLACE FUNCTION public.charge_order_credit_line(p_order_id uuid, p_created_by uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_agent public.profiles%ROWTYPE;
  v_super public.profiles%ROWTYPE;
  v_super_id uuid;
  v_unbilled numeric := 0;
  v_inflight numeric := 0;
  v_chain_projected numeric;
BEGIN
  -- Lock order to prevent concurrent duplicate charges
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  -- Only applies if the order belongs to an agent
  IF v_order.agent_id IS NULL THEN
    RETURN;
  END IF;

  -- Verify it has not already been charged
  IF EXISTS (
    SELECT 1 FROM public.balance_transactions
    WHERE reference_id = p_order_id AND type = 'order_charge'
  ) THEN
    RETURN;
  END IF;

  -- ==== ATOMIC SUPER-AGENT CHAIN CREDIT GATE (H9 TOCTOU) ====
  -- Determine the billing super-agent for this order and, under its row lock,
  -- verify the chain's outstanding exposure. Mirrors checkSuperAgentCredit:
  -- pending_payment weekly statements + COGS of approved, non-restock, unbilled
  -- orders across the chain (super-agent + sub-agents), super-agent cost for
  -- sub-agent orders (fallback agent cost, clamped >= 0), plus shipping. THIS
  -- order is already committed-approved so it is naturally included in the sum.
  -- RAISE on breach: the caller demotes the order to agent_approval_pending.
  SELECT * INTO v_agent FROM public.profiles WHERE id = v_order.agent_id;
  IF v_agent.role = 'super_agent' OR v_agent.is_super_agent = true THEN
    v_super_id := v_agent.id;
  ELSIF v_agent.parent_agent_id IS NOT NULL THEN
    v_super_id := v_agent.parent_agent_id;
  ELSE
    v_super_id := NULL;
  END IF;

  IF v_super_id IS NOT NULL THEN
    SELECT * INTO v_super FROM public.profiles WHERE id = v_super_id FOR UPDATE;
    IF FOUND AND v_super.account_type = 'credit' THEN
      SELECT COALESCE(SUM(total_owed), 0) INTO v_unbilled
      FROM public.weekly_statements
      WHERE agent_id = v_super_id AND status = 'pending_payment';

      SELECT COALESCE(SUM(order_cost), 0) INTO v_inflight
      FROM (
        SELECT COALESCE(o.shipping_cost, 0) + COALESCE((
          SELECT SUM(
            GREATEST(0,
              CASE
                WHEN o.agent_id <> v_super_id THEN
                  CASE WHEN oi.unit_super_agent_cost IS NOT NULL AND oi.unit_super_agent_cost > 0
                       THEN oi.unit_super_agent_cost ELSE COALESCE(oi.unit_cost_price, 0) END
                ELSE COALESCE(oi.unit_cost_price, 0)
              END
            ) * COALESCE(oi.quantity, 0)
          )
          FROM public.order_items oi WHERE oi.order_id = o.id
        ), 0) AS order_cost
        FROM public.orders o
        WHERE o.agent_id IN (
            SELECT id FROM public.profiles
            WHERE id = v_super_id OR parent_agent_id = v_super_id
          )
          AND COALESCE(o.is_wholesale_restock, false) = false
          AND o.status IN ('approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered')
          AND NOT EXISTS (SELECT 1 FROM public.statement_orders so WHERE so.order_id = o.id)
      ) chain_orders;

      v_chain_projected := v_unbilled + v_inflight;
      IF v_chain_projected > COALESCE(v_super.credit_limit, 0) THEN
        RAISE EXCEPTION 'Chain credit limit exceeded. Projected %, limit %',
          round(v_chain_projected, 2), COALESCE(v_super.credit_limit, 0)
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  -- ==== end chain gate ====

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_order.agent_id FOR UPDATE;

  -- Only charge credit line for 'credit' account types
  IF v_profile.account_type IS DISTINCT FROM 'credit' THEN
    RETURN;
  END IF;

  IF COALESCE(v_profile.credit_used, 0) + v_order.total > COALESCE(v_profile.credit_limit, 0) THEN
    RAISE EXCEPTION 'Insufficient credit line limit. Required: %, Available: %',
      v_order.total,
      COALESCE(v_profile.credit_limit, 0) - COALESCE(v_profile.credit_used, 0);
  END IF;

  UPDATE public.profiles
  SET credit_used = COALESCE(credit_used, 0) + v_order.total,
      updated_at = NOW()
  WHERE id = v_order.agent_id;

  INSERT INTO public.balance_transactions
    (agent_id, type, amount, description, reference_id, reference_type, created_by)
  VALUES
    (v_order.agent_id, 'order_charge', v_order.total,
     'Credit Charge For Order ' || left(p_order_id::text, 8),
     p_order_id, 'order', p_created_by);

END;
$function$;

-- Retire the standalone gate helper: superseded by the in-RPC check above.
DROP FUNCTION IF EXISTS public.gate_order_chain_credit(uuid, uuid, numeric);