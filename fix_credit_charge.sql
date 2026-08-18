CREATE OR REPLACE FUNCTION charge_order_credit_line(p_order_id uuid, p_created_by uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_agent public.profiles%ROWTYPE;
  v_super_id uuid;
  v_unbilled numeric := 0;
  v_inflight numeric := 0;
  v_chain_projected numeric;
  v_billed_agent_id uuid;
  v_total_cogs numeric := 0;
  v_shipping numeric := 0;
  v_total_owed numeric := 0;
  v_item record;
  v_super_tier text;
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

  -- ==== Determine the billing super-agent ====
  SELECT * INTO v_agent FROM public.profiles WHERE id = v_order.agent_id;
  IF v_agent.role = 'super_agent' OR v_agent.is_super_agent = true THEN
    v_billed_agent_id := v_agent.id;
  ELSIF v_agent.parent_agent_id IS NOT NULL THEN
    v_billed_agent_id := v_agent.parent_agent_id;
  ELSE
    v_billed_agent_id := v_agent.id;
  END IF;

  -- ==== Calculate COGS instead of Retail Total ====
  -- This mirrors the TypeScript logic in agent/orders/approve
  FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id LOOP
    IF v_billed_agent_id != v_order.agent_id THEN
      IF v_item.unit_super_agent_cost IS NOT NULL AND v_item.unit_super_agent_cost >= 0 THEN
        v_total_cogs := v_total_cogs + (v_item.unit_super_agent_cost * COALESCE(v_item.quantity, 0));
      ELSE
        v_total_cogs := v_total_cogs + (COALESCE(v_item.unit_cost_price, 0) * COALESCE(v_item.quantity, 0));
      END IF;
    ELSE
      v_total_cogs := v_total_cogs + (COALESCE(v_item.unit_cost_price, 0) * COALESCE(v_item.quantity, 0));
    END IF;
  END LOOP;

  v_shipping := COALESCE(v_order.shipping_cost, 0);
  v_total_owed := v_total_cogs + v_shipping;

  -- ==== ATOMIC SUPER-AGENT CHAIN CREDIT GATE (H9 TOCTOU) ====
  IF v_billed_agent_id IS NOT NULL THEN
    SELECT * INTO v_agent FROM public.profiles WHERE id = v_billed_agent_id FOR UPDATE;
    IF FOUND AND v_agent.account_type = 'credit' THEN
      SELECT COALESCE(SUM(total_owed), 0) INTO v_unbilled
      FROM public.weekly_statements
      WHERE agent_id = v_billed_agent_id AND status = 'pending_payment';

      SELECT COALESCE(SUM(order_cost), 0) INTO v_inflight
      FROM (
        SELECT COALESCE(o.shipping_cost, 0) + COALESCE((
          SELECT SUM(
            GREATEST(0,
              CASE
                WHEN o.agent_id <> v_billed_agent_id THEN
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
            WHERE id = v_billed_agent_id OR parent_agent_id = v_billed_agent_id
          )
          AND COALESCE(o.is_wholesale_restock, false) = false
          AND o.status IN ('approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered')
          AND NOT EXISTS (SELECT 1 FROM public.statement_orders so WHERE so.order_id = o.id)
      ) chain_orders;

      v_chain_projected := v_unbilled + v_inflight;
      IF v_chain_projected > COALESCE(v_agent.credit_limit, 0) THEN
        RAISE EXCEPTION 'Chain credit limit exceeded. Projected %, limit %',
          round(v_chain_projected, 2), COALESCE(v_agent.credit_limit, 0)
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  -- ==== end chain gate ====

  -- Only charge credit line for 'credit' account types
  IF v_agent.account_type IS DISTINCT FROM 'credit' THEN
    RETURN;
  END IF;

  IF COALESCE(v_agent.credit_used, 0) + v_total_owed > COALESCE(v_agent.credit_limit, 0) THEN
    RAISE EXCEPTION 'Insufficient credit line limit. Required: %, Available: %',
      v_total_owed,
      COALESCE(v_agent.credit_limit, 0) - COALESCE(v_agent.credit_used, 0);
  END IF;

  UPDATE public.profiles
  SET credit_used = COALESCE(credit_used, 0) + v_total_owed,
      updated_at = NOW()
  WHERE id = v_billed_agent_id;

  INSERT INTO public.balance_transactions
    (agent_id, type, amount, description, reference_id, reference_type, created_by)
  VALUES
    (v_billed_agent_id, 'order_charge', v_total_owed,
     'Credit Charge For Order ' || left(p_order_id::text, 8),
     p_order_id, 'order', p_created_by);

END;
$$;
