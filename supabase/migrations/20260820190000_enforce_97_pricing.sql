-- Hard rule: All retail prices in the storefront must end in .97
-- This trigger runs BEFORE INSERT OR UPDATE on agent_products
-- and snaps the retail_price UP to the nearest .97.
-- It then recalculates margin_percent so the math is strictly consistent.

CREATE OR REPLACE FUNCTION snap_agent_product_to_97()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_cost numeric;
BEGIN
  IF NEW.retail_price IS NOT NULL THEN
    -- Snap to .97
    -- Using integer math to avoid float precision issues:
    -- Multiply by 100, round, subtract 3, if less than original add 100.
    DECLARE
      v_raw_cents int := ROUND(NEW.retail_price * 100);
      v_snapped_cents int;
    BEGIN
      -- Calculate the nearest .97
      v_snapped_cents := (ROUND(v_raw_cents / 100.0) * 100) - 3;
      IF v_snapped_cents < v_raw_cents THEN
         v_snapped_cents := v_snapped_cents + 100;
      END IF;
      
      NEW.retail_price := v_snapped_cents / 100.0;
    END;

    -- Recalculate margin_percent so the DB math doesn't complain later
    -- We need the base cost or chain cost for this.
    v_cost := public.fn_agent_chain_cost(NEW.agent_id, NEW.product_id);
    IF v_cost IS NOT NULL AND v_cost > 0 THEN
      NEW.margin_percent := ROUND(((NEW.retail_price / v_cost) - 1) * 100, 2);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snap_agent_product_to_97 ON agent_products;
CREATE TRIGGER trg_snap_agent_product_to_97
  BEFORE INSERT OR UPDATE ON agent_products
  FOR EACH ROW
  EXECUTE FUNCTION snap_agent_product_to_97();
