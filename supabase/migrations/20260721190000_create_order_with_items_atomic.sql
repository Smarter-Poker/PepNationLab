-- Atomic order creation: insert the order header AND all its line items in a
-- single transaction (a plpgsql function body is one implicit transaction).
-- Previously checkout (app/api/orders/route.ts) and the researcher reorder
-- route inserted the order, then separately inserted items; a crash between
-- the two left a headerless order row (later swept by the stale-order cron).
-- Now either both land or neither does. Idempotency-key races are resolved
-- INSIDE the transaction so the caller still gets the replay signal.
--
-- p_order : jsonb with exactly the columns the JS checkout/reorder inserted.
-- p_items : jsonb array of line items (order_id is set here, not by callers).
-- returns : { order_id uuid, total numeric, replayed boolean }
CREATE OR REPLACE FUNCTION public.create_order_with_items_atomic(p_order jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_order_id uuid;
  v_total numeric;
  v_idem uuid := NULLIF(p_order->>'idempotency_key', '')::uuid;
  v_buyer uuid := (p_order->>'buyer_id')::uuid;
  v_existing_id uuid;
  v_existing_total numeric;
BEGIN
  BEGIN
    INSERT INTO public.orders (
      buyer_id, buyer_name, buyer_email, agent_id, is_wholesale_restock,
      status, fulfillment_method, payment_method, shipping_address,
      shipping_cost, carrier, subtotal, discount_amount, discount_source,
      coupon_code, total, inventory_reserved, idempotency_key
    ) VALUES (
      v_buyer,
      p_order->>'buyer_name',
      p_order->>'buyer_email',
      NULLIF(p_order->>'agent_id', '')::uuid,
      COALESCE((p_order->>'is_wholesale_restock')::boolean, false),
      (p_order->>'status')::order_status,
      NULLIF(p_order->>'fulfillment_method', '')::fulfillment_method,
      (p_order->>'payment_method')::payment_method,
      NULLIF(p_order->'shipping_address', 'null'::jsonb),
      COALESCE((p_order->>'shipping_cost')::numeric, 0),
      p_order->>'carrier',
      (p_order->>'subtotal')::numeric,
      COALESCE((p_order->>'discount_amount')::numeric, 0),
      p_order->>'discount_source',
      p_order->>'coupon_code',
      (p_order->>'total')::numeric,
      COALESCE((p_order->>'inventory_reserved')::boolean, false),
      v_idem
    )
    RETURNING id, total INTO v_order_id, v_total;
  EXCEPTION WHEN unique_violation THEN
    -- A concurrent request with the same idempotency_key won the insert race.
    -- Return the winner's order and signal replay so the caller compensates
    -- THIS attempt's inventory/coupon/prepaid side effects. The failed insert
    -- (this sub-block) is rolled back; nothing partial persists.
    IF v_idem IS NULL THEN
      RAISE; -- not the idempotency index -- surface the real error
    END IF;
    SELECT id, total INTO v_existing_id, v_existing_total
    FROM public.orders
    WHERE idempotency_key = v_idem AND buyer_id = v_buyer
    LIMIT 1;
    IF v_existing_id IS NULL THEN
      RAISE; -- unique violation on some other constraint -- surface it
    END IF;
    RETURN jsonb_build_object('order_id', v_existing_id, 'total', COALESCE(v_existing_total, 0), 'replayed', true);
  END;

  -- Same transaction: insert every line item. A failure here (or in any
  -- order_items trigger, e.g. the banned-product guard) rolls back the order
  -- header too -- a headerless order can no longer exist. agent_product_id is
  -- optional (checkout omits it, the reorder route stamps it).
  INSERT INTO public.order_items (
    order_id, agent_product_id, product_id, product_name, quantity,
    unit_retail_price, unit_cost_price, unit_super_agent_cost, unit_house_cost, fulfilled_locally
  )
  SELECT
    v_order_id,
    NULLIF(it->>'agent_product_id', '')::uuid,
    NULLIF(it->>'product_id', '')::uuid,
    COALESCE(it->>'product_name', 'Unknown Product'),
    COALESCE((it->>'quantity')::int, 1),
    (it->>'unit_retail_price')::numeric,
    (it->>'unit_cost_price')::numeric,
    NULLIF(it->>'unit_super_agent_cost', '')::numeric,
    NULLIF(it->>'unit_house_cost', '')::numeric,
    COALESCE((it->>'fulfilled_locally')::boolean, false)
  FROM jsonb_array_elements(p_items) AS it;

  IF NOT FOUND THEN
    -- No items -- roll the whole order back rather than persist a headerless one.
    RAISE EXCEPTION 'create_order_with_items_atomic: no line items provided';
  END IF;

  RETURN jsonb_build_object('order_id', v_order_id, 'total', COALESCE(v_total, 0), 'replayed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_with_items_atomic(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_items_atomic(jsonb, jsonb) TO service_role;
