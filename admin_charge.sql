CREATE OR REPLACE FUNCTION admin_charge_order_billing(p_order_id uuid, p_created_by uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_agent public.profiles%ROWTYPE;
  v_billed_agent_id uuid;
  v_total_cogs numeric := 0;
  v_shipping numeric := 0;
  v_total_owed numeric := 0;
  v_item record;
BEGIN
  -- Lock order
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.agent_id IS NULL THEN RETURN; END IF;

  -- Determine billing super-agent
  SELECT * INTO v_agent FROM public.profiles WHERE id = v_order.agent_id;
  IF v_agent.role = 'super_agent' OR v_agent.is_super_agent = true THEN
    v_billed_agent_id := v_agent.id;
  ELSIF v_agent.parent_agent_id IS NOT NULL THEN
    v_billed_agent_id := v_agent.parent_agent_id;
  ELSE
    v_billed_agent_id := v_agent.id;
  END IF;

  -- Calculate COGS
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

  -- Verify it has not already been charged
  IF EXISTS (
    SELECT 1 FROM public.balance_transactions
    WHERE reference_id = p_order_id AND type = 'order_charge'
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO v_agent FROM public.profiles WHERE id = v_billed_agent_id FOR UPDATE;

  IF v_agent.account_type = 'prepaid' THEN
    IF COALESCE(v_agent.prepaid_balance, 0) < v_total_owed THEN
      RAISE EXCEPTION 'Insufficient prepaid balance for order %. Required: %, Available: %', p_order_id, v_total_owed, COALESCE(v_agent.prepaid_balance, 0);
    END IF;

    UPDATE public.profiles
    SET prepaid_balance = COALESCE(prepaid_balance, 0) - v_total_owed,
        updated_at = NOW()
    WHERE id = v_billed_agent_id;

    INSERT INTO public.balance_transactions
      (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, created_by)
    VALUES
      (v_billed_agent_id, 'order_charge', v_total_owed, COALESCE(v_agent.prepaid_balance, 0), COALESCE(v_agent.prepaid_balance, 0) - v_total_owed,
       'Order charge (' || left(p_order_id::text, 8) || ')', p_order_id, 'order', p_created_by);
  ELSE
    PERFORM charge_order_credit_line(p_order_id, p_created_by);
  END IF;
END;
$$;
