-- Switch Sub-Agent commission calculation to use Gross Profit instead of Revenue.
-- This mathematically safeguards the Agent from losing money if they sell low-margin items.

CREATE OR REPLACE FUNCTION public.accrue_sub_agent_commission(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_sub_agent RECORD;
  v_super_agent RECORD;
  v_effective_pct NUMERIC(5,2);
  v_amount NUMERIC(10,2);
  v_delta_pct NUMERIC(5,2);
  v_delta_amount NUMERIC(10,2);
  v_ledger_id UUID;
  v_total_cost NUMERIC(10,2);
  v_gross_profit NUMERIC(10,2);
BEGIN
  SELECT id, referring_sub_agent_id, subtotal
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.referring_sub_agent_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, commission_pct, parent_agent_id
  INTO v_sub_agent
  FROM public.profiles
  WHERE id = v_order.referring_sub_agent_id
    AND is_sub_agent = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sub-agent % not found or not flagged is_sub_agent', v_order.referring_sub_agent_id;
  END IF;

  -- Get total wholesale cost for this order
  SELECT COALESCE(SUM(unit_cost_price * quantity), 0)
  INTO v_total_cost
  FROM public.order_items
  WHERE order_id = p_order_id;

  v_gross_profit := v_order.subtotal - v_total_cost;
  IF v_gross_profit < 0 THEN
    v_gross_profit := 0;
  END IF;

  -- Get Super Agent wholesale rate
  SELECT commission_rate INTO v_super_agent
  FROM public.profiles
  WHERE id = v_sub_agent.parent_agent_id;

  -- Calculate Effective Sub Agent Rate
  v_effective_pct := public.fn_sub_agent_effective_commission(v_sub_agent.id);
  
  -- Safeguard: hard cap internal commission at 49.9% of Gross Profit to ensure Agent always makes more
  IF v_effective_pct > 49.9 THEN
    v_effective_pct := 49.9;
  END IF;

  -- CALCULATE AGAINST GROSS PROFIT instead of subtotal
  v_amount := ROUND((v_gross_profit * v_effective_pct / 100.0)::numeric, 2);

  -- Calculate Super Agent Delta
  v_delta_pct := COALESCE(v_super_agent.commission_rate, 0) - v_effective_pct;
  IF v_delta_pct < 0 THEN v_delta_pct := 0; END IF;
  
  -- Super Agent Delta is also calculated against Gross Profit
  v_delta_amount := ROUND((v_gross_profit * v_delta_pct / 100.0)::numeric, 2);

  UPDATE public.orders
  SET sub_agent_commission_pct = v_effective_pct,
      sub_agent_commission_amount = v_amount,
      updated_at = NOW()
  WHERE id = v_order.id;

  INSERT INTO public.sub_agent_commission_ledger (
    order_id, sub_agent_id, parent_agent_id, commission_pct,
    gross_product_subtotal, commission_amount, status,
    parent_delta_pct, parent_delta_amount
  ) VALUES (
    v_order.id, v_sub_agent.id, v_sub_agent.parent_agent_id, v_effective_pct,
    v_order.subtotal, v_amount, 'pending',
    v_delta_pct, v_delta_amount
  )
  ON CONFLICT (order_id) DO UPDATE SET
    commission_pct = EXCLUDED.commission_pct,
    commission_amount = EXCLUDED.commission_amount,
    parent_delta_pct = EXCLUDED.parent_delta_pct,
    parent_delta_amount = EXCLUDED.parent_delta_amount
  RETURNING id INTO v_ledger_id;

  RETURN v_ledger_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accrue_sub_agent_commission(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accrue_sub_agent_commission(UUID) TO service_role;
