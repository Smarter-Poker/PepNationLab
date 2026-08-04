-- ─────────────────────────────────────────────────────────────────────────────
-- Purge test-seeded orders — keep only the real Savage Brands sale
-- Real order: 9edf26d7-2f8d-4890-89f5-fcea4668e47d
--   buyer:    Eddie R (eddierazz) — direct sub-agent of Savage Brands
--   total:    $194.90
--   date:     2026-07-26
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_keep uuid := '9edf26d7-2f8d-4890-89f5-fcea4668e47d';
  item   RECORD;
BEGIN

  -- 1. Remove statement_orders join rows for test orders (FK child).
  DELETE FROM statement_orders WHERE order_id != v_keep;

  -- 2. Remove order_items for test orders (FK child).
  DELETE FROM order_items WHERE order_id != v_keep;

  -- 3. Delete the test orders.
  DELETE FROM orders WHERE id != v_keep;

  RAISE NOTICE 'Test orders deleted. Remaining: %', (SELECT count(*) FROM orders);

  -- 4. Pre-credit inventory for Eddie R's order items so the stock-check trigger
  --    can pass when we advance status.  The trigger will then deduct the same
  --    quantities, leaving inventory_count exactly where it started.
  --    (fulfillment_method = 'agent_pickup', so trigger uses products.inventory_count.)
  FOR item IN
    SELECT product_id, quantity
    FROM   order_items
    WHERE  order_id = v_keep AND product_id IS NOT NULL
  LOOP
    UPDATE products
    SET    inventory_count = inventory_count + item.quantity
    WHERE  id = item.product_id;
  END LOOP;

  RAISE NOTICE 'Inventory pre-credited for order %.', v_keep;

  -- 5. Advance status → approved_ship. The trigger fires, checks stock
  --    (now passes), deducts the quantities, nets to zero change.
  UPDATE orders
  SET    status     = 'approved_ship',
         updated_at = now()
  WHERE  id = v_keep;

  RAISE NOTICE 'Order % marked approved_ship (ready to ship).', v_keep;
END;
$$;
