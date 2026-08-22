-- ============================================================
-- MANUFACTURER ACCOUNTS (2026-07-15)
--
-- A manufacturer is an agent-type store owned by the product factory
-- itself (the China manufacturer). Model:
--   * Unrestricted pricing: no MAP floor, no cost floor, no admin-price
--     ceiling, no margin cap. The manufacturer types a price per 10-vial
--     pack and that IS the price.
--   * Catalog moves in 10-vial multiples only (enforced in /api/orders).
--   * No coupons, signup promos, flash sales, quantity discounts, or
--     bundles on a manufacturer store.
--   * Settlement via manufacturer_ledger: the platform keeps
--     profiles.manufacturer_commission_pct (default 10%) of each order's
--     PRODUCT subtotal; shipping passes through to the manufacturer.
--   * agent_products.manufacturer_cost is the manufacturer's own private
--     production cost per 10-pack, used only for their profit display.
--
-- Idempotent: safe to re-run.
-- ============================================================

-- 1. Columns And Flags -------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_manufacturer boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS manufacturer_commission_pct numeric(5,2) NOT NULL DEFAULT 10.00;

COMMENT ON COLUMN public.profiles.is_manufacturer IS
  'Manufacturer store owner: unrestricted pricing, 10-vial multiples only, settled via manufacturer_ledger commission split instead of COGS statements.';

COMMENT ON COLUMN public.profiles.manufacturer_commission_pct IS
  'Platform commission percentage taken on the product subtotal of every order on this manufacturer''s store. Default 10.';

ALTER TABLE public.agent_profiles
  ADD COLUMN IF NOT EXISTS is_manufacturer_store boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.agent_profiles.is_manufacturer_store IS
  'Mirror of profiles.is_manufacturer for public storefront reads (storefront + checkout UI). Kept in sync by triggers; never hand-edit.';

ALTER TABLE public.agent_products
  ADD COLUMN IF NOT EXISTS manufacturer_cost numeric(10,2) NULL;

COMMENT ON COLUMN public.agent_products.manufacturer_cost IS
  'Manufacturer-entered private production cost PER 10-VIAL PACK. Profit-display input on the manufacturer dashboard only; never read by checkout pricing.';

-- 2. Mirror is_manufacturer Onto agent_profiles ------------------------

CREATE OR REPLACE FUNCTION public.fn_sync_manufacturer_store_flag()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.agent_profiles
  SET is_manufacturer_store = NEW.is_manufacturer
  WHERE id = NEW.id
    AND is_manufacturer_store IS DISTINCT FROM NEW.is_manufacturer;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_manufacturer_store_flag ON public.profiles;
CREATE TRIGGER trg_sync_manufacturer_store_flag
  AFTER UPDATE OF is_manufacturer ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_manufacturer_store_flag();

-- Storefront rows are provisioned AFTER the profile exists (role change),
-- so stamp the flag at agent_profiles insert time too.
CREATE OR REPLACE FUNCTION public.fn_stamp_manufacturer_store_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  SELECT COALESCE(is_manufacturer, false)
    INTO NEW.is_manufacturer_store
  FROM public.profiles WHERE id = NEW.id;
  NEW.is_manufacturer_store := COALESCE(NEW.is_manufacturer_store, false);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_stamp_manufacturer_store_on_insert ON public.agent_profiles;
CREATE TRIGGER trg_stamp_manufacturer_store_on_insert
  BEFORE INSERT ON public.agent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_stamp_manufacturer_store_on_insert();

-- 3. Price Ceiling: Manufacturers Are Exempt (Zero Restrictions) -------

CREATE OR REPLACE FUNCTION public.enforce_agent_product_price_ceiling()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_max_retail_price numeric(10,2);
  v_role text;
  v_is_manufacturer boolean;
BEGIN
  -- Admin store sets the ceiling itself; never cap it.
  -- Manufacturer stores have unrestricted pricing; never cap them.
  SELECT role, COALESCE(is_manufacturer, false)
    INTO v_role, v_is_manufacturer
  FROM profiles WHERE id = NEW.agent_id;
  IF v_role = 'admin' OR v_is_manufacturer THEN
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

-- 4. Admin Price Propagation Never Touches Manufacturer Stores ---------

CREATE OR REPLACE FUNCTION public.fn_propagate_admin_price_to_stores()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
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
  --     Manufacturer stores are EXEMPT: their pricing is theirs alone and is
  --     never mirrored, clamped, or overwritten by admin price changes.
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
      AND ap.agent_id NOT IN (SELECT id FROM public.profiles WHERE is_manufacturer = true)
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

-- 5. protect_profile_columns: Manufacturer Flags Are Admin-Only --------

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF current_setting('role', true) = 'authenticated' THEN
    NEW.role := OLD.role;
    NEW.credit_limit := OLD.credit_limit;
    NEW.prepaid_balance := OLD.prepaid_balance;
    NEW.auto_approve_orders := OLD.auto_approve_orders;
    NEW.tier := OLD.tier;
    NEW.is_active := OLD.is_active;
    NEW.is_super_agent := OLD.is_super_agent;
    NEW.parent_agent_id := OLD.parent_agent_id;
    NEW.is_sub_agent := OLD.is_sub_agent;
    NEW.commission_pct := OLD.commission_pct;
    NEW.referring_sub_agent_id := OLD.referring_sub_agent_id;
    NEW.created_by_agent_id := OLD.created_by_agent_id;
    NEW.created_by_role := OLD.created_by_role;
    NEW.first_sign_in_at := OLD.first_sign_in_at;
    NEW.last_sign_in_at := OLD.last_sign_in_at;
    NEW.sign_in_count := OLD.sign_in_count;
    NEW.account_activated_at := OLD.account_activated_at;
    NEW.account_type := OLD.account_type;
    NEW.max_auto_approve_limit := OLD.max_auto_approve_limit;
    NEW.credit_used := OLD.credit_used;
    NEW.referring_agent_id := OLD.referring_agent_id;
    NEW.custom_markup_override := OLD.custom_markup_override;
    NEW.locked_tier_level := OLD.locked_tier_level;
    NEW.house_tier_level := OLD.house_tier_level;
    NEW.velocity_cap := OLD.velocity_cap;
    NEW.fixed_scale_override := OLD.fixed_scale_override;
    -- Agent-funded payouts audit 2026-07-12 (Exploit C1):
    NEW.referral_reward_enabled := OLD.referral_reward_enabled;
    NEW.referral_reward_amount := OLD.referral_reward_amount;
    -- Manufacturer accounts 2026-07-15: self-escalation blocked.
    NEW.is_manufacturer := OLD.is_manufacturer;
    NEW.manufacturer_commission_pct := OLD.manufacturer_commission_pct;
  END IF;
  RETURN NEW;
END;
$function$;

-- 6. New Products Seed Manufacturer Stores At Base Cost ----------------

CREATE OR REPLACE FUNCTION public.seed_agent_products_for_new_product()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.is_active = false OR COALESCE(NEW.is_banned, false) THEN RETURN NEW; END IF;

  -- Manufacturer stores launch every product at the platform base cost per
  -- 10-pack (their own wholesale number); everyone else keeps the tier
  -- formula with the 50% default margin.
  INSERT INTO public.agent_products (agent_id, product_id, retail_price, margin_percent, is_visible, sort_order)
  SELECT
    p.id,
    NEW.id,
    CASE
      WHEN COALESCE(p.is_manufacturer, false) THEN ROUND(NEW.base_cost, 2)
      ELSE ROUND(
        NEW.base_cost
        * COALESCE(
            (SELECT custom_multiplier FROM public.product_tier_overrides
               WHERE product_id = NEW.id AND tier_name = COALESCE(p.tier::text, 'tier_3')::tier_name),
            (SELECT multiplier FROM public.pricing_tiers
               WHERE tier_name = COALESCE(p.tier::text, 'tier_3')::tier_name),
            1.7)
        * 1.5,   -- 50% default margin
        2)
    END,
    CASE WHEN COALESCE(p.is_manufacturer, false) THEN 0.0 ELSE 50.0 END,
    true,
    0
  FROM public.profiles p
  WHERE p.role IN ('agent', 'super_agent')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 7. Manufacturer Commission Ledger ------------------------------------

CREATE TABLE IF NOT EXISTS public.manufacturer_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  manufacturer_id uuid NOT NULL REFERENCES public.profiles(id),
  product_subtotal numeric(12,2) NOT NULL,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  commission_base numeric(12,2) NOT NULL,
  commission_pct numeric(5,2) NOT NULL,
  platform_commission numeric(12,2) NOT NULL,
  manufacturer_net numeric(12,2) NOT NULL,
  shipping_collected numeric(12,2) NOT NULL DEFAULT 0,
  voided_at timestamptz NULL,
  void_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.manufacturer_ledger IS
  'One row per order placed on a manufacturer store. commission_base = product subtotal minus discounts (shipping EXCLUDED). platform_commission = commission_base x commission_pct / 100 (what the platform keeps); manufacturer_net = commission_base - platform_commission (the manufacturer''s 90%). shipping_collected passes through to the manufacturer in full. Written by the order route with the service client; voided (never deleted) when the order is cancelled.';

CREATE INDEX IF NOT EXISTS idx_manufacturer_ledger_mfr
  ON public.manufacturer_ledger (manufacturer_id, created_at DESC);

ALTER TABLE public.manufacturer_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manufacturer_ledger_own_read ON public.manufacturer_ledger;
CREATE POLICY manufacturer_ledger_own_read ON public.manufacturer_ledger
  FOR SELECT TO authenticated
  USING (manufacturer_id = auth.uid() OR public.is_admin());
-- No INSERT/UPDATE/DELETE policies: only the service-role client writes.

-- 8. Void The Ledger Row When An Order Is Cancelled --------------------

CREATE OR REPLACE FUNCTION public.fn_void_manufacturer_ledger_on_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.manufacturer_ledger
    SET voided_at = now(),
        void_reason = 'Order Cancelled'
    WHERE order_id = NEW.id
      AND voided_at IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_void_manufacturer_ledger ON public.orders;
CREATE TRIGGER trg_void_manufacturer_ledger
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_void_manufacturer_ledger_on_cancel();
