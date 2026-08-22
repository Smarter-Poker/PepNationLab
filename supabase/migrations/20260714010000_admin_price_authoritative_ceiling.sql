-- ============================================================
-- ADMIN PRICE = AUTHORITATIVE CEILING
-- Corrects 20260713230000_max_retail_price_ceiling.sql, which set the cap to
-- base_cost * tier1_multiplier and capped the ADMIN store's own prices down to it,
-- destroying the hand-set admin pricing on 2026-07-13.
--
-- Model enforced here:
--   * The ADMIN (house) store's agent_products.retail_price IS the price of record
--     for each product, and products.max_retail_price = that admin price = hard ceiling.
--   * Every other store mirrors the admin price by default. An agent MAY set a LOWER
--     price but NEVER a higher one (enforced by trg_agent_product_price_ceiling).
--   * When the admin changes a price, the cap and all mirroring stores update in real
--     time (trg_propagate_admin_price). A store that deliberately discounts keeps its
--     lower price, clamped so it can never exceed the new cap.
--   * Legacy base_cost/markup auto-repricers are removed (they overwrote retail_price
--     and max_retail_price and fought this model).
--
-- Idempotent: safe to re-run.
-- House store = single admin account b8bd12e6-8196-401e-b37b-f742caf1596c (slug researchstore).
-- ============================================================

-- 0. Column guard (already added by the prior migration; here for fresh installs)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS max_retail_price numeric(10,2) NULL;

-- 1. Ceiling enforcement WITH admin bypass (the admin store defines the ceiling)
CREATE OR REPLACE FUNCTION public.enforce_agent_product_price_ceiling()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_max_retail_price numeric(10,2);
  v_role text;
BEGIN
  -- Admin store sets the ceiling itself; never cap it.
  SELECT role INTO v_role FROM profiles WHERE id = NEW.agent_id;
  IF v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  SELECT max_retail_price INTO v_max_retail_price
  FROM products
  WHERE id = NEW.product_id;

  IF v_max_retail_price IS NOT NULL THEN
    IF NEW.retail_price > v_max_retail_price THEN
      RAISE EXCEPTION 'retail_price (%) exceeds max_retail_price (%) for this product',
        NEW.retail_price, v_max_retail_price;
    END IF;
    IF NEW.sale_price IS NOT NULL AND NEW.sale_price > v_max_retail_price THEN
      RAISE EXCEPTION 'sale_price (%) exceeds max_retail_price (%) for this product',
        NEW.sale_price, v_max_retail_price;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Remove legacy base_cost / markup-driven auto-repricers (kept functions, dropped triggers)
DROP TRIGGER IF EXISTS trg_sync_max_retail_price ON public.products;
DROP TRIGGER IF EXISTS trg_sync_retail_price_on_product_change ON public.products;
DROP TRIGGER IF EXISTS trg_sync_retail_price_on_house_tier_change ON public.house_tiers;
DROP TRIGGER IF EXISTS trg_recalc_agent_products_on_markup_change ON public.profiles;

-- 3. Real-time propagation from the admin store to the cap + every other store
CREATE OR REPLACE FUNCTION public.fn_propagate_admin_price_to_stores()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public','pg_temp'
AS $function$
BEGIN
  -- Only the admin house store drives propagation.
  IF NEW.agent_id <> 'b8bd12e6-8196-401e-b37b-f742caf1596c' THEN
    RETURN NULL;
  END IF;

  -- (1) The admin price IS the max. Refresh the product cap first so downstream
  --     ceiling checks on other stores pass in this same transaction.
  UPDATE products
  SET max_retail_price = NEW.retail_price
  WHERE id = NEW.product_id
    AND max_retail_price IS DISTINCT FROM NEW.retail_price
    AND NOT COALESCE(is_banned, false);

  -- (2) Propagate to every other store (only on real price changes).
  IF TG_OP = 'UPDATE' AND NEW.retail_price IS DISTINCT FROM OLD.retail_price THEN
    UPDATE agent_products ap
    SET retail_price = CASE
                         WHEN ap.retail_price = OLD.retail_price THEN NEW.retail_price
                         ELSE LEAST(ap.retail_price, NEW.retail_price)
                       END,
        sale_price   = CASE
                         WHEN ap.sale_price IS NOT NULL AND ap.sale_price > NEW.retail_price THEN NEW.retail_price
                         ELSE ap.sale_price
                       END
    WHERE ap.product_id = NEW.product_id
      AND ap.agent_id <> NEW.agent_id
      AND NOT COALESCE((SELECT is_banned FROM products WHERE id = ap.product_id), false)
      AND (
            (ap.retail_price = OLD.retail_price)
            OR ap.retail_price > NEW.retail_price
            OR (ap.sale_price IS NOT NULL AND ap.sale_price > NEW.retail_price)
          );
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_propagate_admin_price ON public.agent_products;
CREATE TRIGGER trg_propagate_admin_price
AFTER INSERT OR UPDATE OF retail_price ON public.agent_products
FOR EACH ROW
EXECUTE FUNCTION public.fn_propagate_admin_price_to_stores();

-- 4. Align data: caps = admin price (idempotent). Retail mirroring for existing stores is
--    handled operationally so any deliberate agent discount is preserved.
UPDATE public.products p
SET max_retail_price = a.retail_price
FROM public.agent_products a
WHERE a.agent_id = 'b8bd12e6-8196-401e-b37b-f742caf1596c'
  AND a.product_id = p.id
  AND p.max_retail_price IS DISTINCT FROM a.retail_price
  AND NOT COALESCE(p.is_banned, false);

COMMENT ON COLUMN public.products.max_retail_price IS
  'Hard ceiling = the admin (house) store retail price for this product. Agents may sell at or below, never above. Maintained by trg_propagate_admin_price.';
