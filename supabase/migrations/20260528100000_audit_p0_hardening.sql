-- =============================================================================
-- PepNationLab P0 Hardening - 2026-05-28
-- Addresses audit findings 1.2, 1.3, 1.12, 1.13, 1.16, 1.17, 2.7, 2.8, 2.9, 2.10,
-- 2.11, 2.16, 2.31, 3.6, 3.7, 3.8, 5.8 and related items.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.deduct_inventory_on_order_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_current_stock INT;
BEGIN
  IF NEW.status NOT IN ('approved_ship', 'approved_pickup', 'in_fulfillment') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  FOR v_item IN
    SELECT oi.agent_product_id, oi.product_id, oi.quantity, oi.product_name, oi.id
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
    ORDER BY oi.id
  LOOP
    IF v_item.agent_product_id IS NOT NULL AND NEW.agent_id IS NOT NULL THEN
      SELECT stock_count INTO v_current_stock
      FROM public.agent_inventory
      WHERE agent_id = NEW.agent_id AND product_id = v_item.product_id
      FOR UPDATE;

      IF v_current_stock IS NULL THEN
        RAISE EXCEPTION 'Inventory not initialised for product % (agent %)',
          v_item.product_name, NEW.agent_id USING ERRCODE = 'check_violation';
      END IF;
      IF v_current_stock < v_item.quantity THEN
        RAISE EXCEPTION 'Insufficient stock for % (have %, need %)',
          v_item.product_name, v_current_stock, v_item.quantity USING ERRCODE = 'check_violation';
      END IF;

      UPDATE public.agent_inventory
      SET stock_count = stock_count - v_item.quantity, updated_at = NOW()
      WHERE agent_id = NEW.agent_id AND product_id = v_item.product_id;
    ELSIF v_item.product_id IS NOT NULL THEN
      SELECT inventory_count INTO v_current_stock
      FROM public.products WHERE id = v_item.product_id FOR UPDATE;

      IF v_current_stock IS NULL THEN
        RAISE EXCEPTION 'Product % not found', v_item.product_id;
      END IF;
      IF NOT COALESCE(NEW.is_wholesale_restock, false) AND v_current_stock < v_item.quantity THEN
        RAISE EXCEPTION 'Insufficient master stock for % (have %, need %)',
          v_item.product_name, v_current_stock, v_item.quantity USING ERRCODE = 'check_violation';
      END IF;

      UPDATE public.products
      SET inventory_count = GREATEST(0, inventory_count - v_item.quantity), updated_at = NOW()
      WHERE id = v_item.product_id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deduct_inventory_on_order_approval() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_deduct_inventory_on_order_approval ON public.orders;
CREATE TRIGGER trg_deduct_inventory_on_order_approval
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_inventory_on_order_approval();

CREATE OR REPLACE FUNCTION public.deduct_prepaid_balance(
  p_agent_id UUID, p_amount NUMERIC,
  p_order_id UUID DEFAULT NULL, p_description TEXT DEFAULT 'Order charge'
) RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_before NUMERIC; v_after NUMERIC;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT prepaid_balance INTO v_before FROM public.profiles WHERE id = p_agent_id FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_before < p_amount THEN
    RAISE EXCEPTION 'Insufficient prepaid balance (have %, need %)', v_before, p_amount USING ERRCODE = 'check_violation';
  END IF;
  v_after := v_before - p_amount;
  UPDATE public.profiles SET prepaid_balance = v_after, updated_at = NOW() WHERE id = p_agent_id;
  INSERT INTO public.balance_transactions
    (agent_id, type, amount, balance_before, balance_after, description,
     reference_id, reference_type, created_by)
  VALUES
    (p_agent_id, 'order_charge', -p_amount, v_before, v_after, p_description,
     p_order_id, CASE WHEN p_order_id IS NULL THEN NULL ELSE 'order' END, p_agent_id);
  RETURN v_after;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.deduct_prepaid_balance(UUID, NUMERIC) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_prepaid_balance(UUID, NUMERIC, UUID, TEXT) FROM anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view agent inventory" ON public.agent_inventory;
DROP POLICY IF EXISTS "agent_inventory public select" ON public.agent_inventory;
DROP POLICY IF EXISTS "Public can view agent inventory" ON public.agent_inventory;
CREATE POLICY "Agents view own inventory" ON public.agent_inventory
  FOR SELECT
  USING (
    agent_id = auth.uid() OR public.is_admin()
    OR (SELECT parent_agent_id FROM public.profiles WHERE id = agent_id) = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.agent_inventory_in_stock(p_agent_id UUID, p_product_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT stock_count > 0 FROM public.agent_inventory
       WHERE agent_id = p_agent_id AND product_id = p_product_id), false);
$$;
GRANT EXECUTE ON FUNCTION public.agent_inventory_in_stock(UUID, UUID) TO anon, authenticated;

DROP POLICY IF EXISTS "Users can insert own disclaimers" ON public.disclaimer_acceptances;
DROP POLICY IF EXISTS "Insert own disclaimer" ON public.disclaimer_acceptances;
CREATE POLICY "Insert own disclaimer (or anon site_entry)" ON public.disclaimer_acceptances
  FOR INSERT
  WITH CHECK ((user_id IS NULL AND layer = 'site_entry') OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their received messages" ON public.internal_messages;
DROP POLICY IF EXISTS "Recipients can mark read" ON public.internal_messages;

CREATE OR REPLACE FUNCTION public.mark_message_read(p_message_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.internal_messages SET is_read = true
  WHERE id = p_message_id AND receiver_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_message_read(UUID) TO authenticated;

DROP POLICY IF EXISTS "Anyone can view pricing tiers" ON public.pricing_tiers;
DROP POLICY IF EXISTS "Public pricing tiers" ON public.pricing_tiers;
CREATE POLICY "Agents view pricing tiers" ON public.pricing_tiers
  FOR SELECT USING (public.is_agent_or_above());

DROP POLICY IF EXISTS "Anyone can view tier overrides" ON public.product_tier_overrides;
DROP POLICY IF EXISTS "Authenticated view tier overrides" ON public.product_tier_overrides;
CREATE POLICY "Agents view tier overrides" ON public.product_tier_overrides
  FOR SELECT USING (public.is_agent_or_above());

DROP POLICY IF EXISTS "Admins manage balance transactions" ON public.balance_transactions;
DROP POLICY IF EXISTS "Admins view balance transactions" ON public.balance_transactions;
DROP POLICY IF EXISTS "Admins insert balance transactions" ON public.balance_transactions;
DROP POLICY IF EXISTS "Agents view own balance transactions" ON public.balance_transactions;
CREATE POLICY "Admins view balance transactions" ON public.balance_transactions
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Agents view own balance transactions" ON public.balance_transactions
  FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "Admins insert balance transactions" ON public.balance_transactions
  FOR INSERT WITH CHECK (public.is_admin());

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
DROP INDEX IF EXISTS profiles_username_key;
DROP INDEX IF EXISTS profiles_username_lower_idx;
CREATE UNIQUE INDEX profiles_username_lower_idx
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

DROP POLICY IF EXISTS "Super agents manage own pricing" ON public.super_agent_pricing;
DROP POLICY IF EXISTS "Super agents read own pricing" ON public.super_agent_pricing;
DROP POLICY IF EXISTS "Super agents insert pricing" ON public.super_agent_pricing;
DROP POLICY IF EXISTS "Super agents update pricing" ON public.super_agent_pricing;
DROP POLICY IF EXISTS "Super agents delete pricing" ON public.super_agent_pricing;
CREATE POLICY "Super agents read own pricing" ON public.super_agent_pricing
  FOR SELECT USING (super_agent_id = auth.uid() OR public.is_admin());
CREATE POLICY "Super agents insert pricing" ON public.super_agent_pricing
  FOR INSERT WITH CHECK (super_agent_id = auth.uid() AND public.is_super_agent());
CREATE POLICY "Super agents update pricing" ON public.super_agent_pricing
  FOR UPDATE
  USING (super_agent_id = auth.uid() AND public.is_super_agent())
  WITH CHECK (super_agent_id = auth.uid() AND public.is_super_agent());
CREATE POLICY "Super agents delete pricing" ON public.super_agent_pricing
  FOR DELETE USING (super_agent_id = auth.uid() AND public.is_super_agent());

DROP INDEX IF EXISTS agent_profiles_slug_lower_idx;
CREATE UNIQUE INDEX agent_profiles_slug_lower_idx ON public.agent_profiles (lower(slug));
ALTER TABLE public.agent_profiles DROP CONSTRAINT IF EXISTS agent_profiles_slug_not_reserved;
ALTER TABLE public.agent_profiles ADD CONSTRAINT agent_profiles_slug_not_reserved CHECK (
  lower(slug) NOT IN (
    'admin','api','app','login','logout','register','signin','signup',
    'dashboard','checkout','cart','orders','order','products','product',
    'messages','message','inbox','shipping','about','terms','privacy',
    'compliance','disclaimer','forgot-password','become-agent',
    'pricing','statements','researchers','sales','transactions','users',
    'auth','health','robots','sitemap','public','assets','_next','www',
    'support','help','contact','blog','docs','status','staff','admin-panel'
  )
);

CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code TEXT, p_agent_id UUID, p_order_subtotal NUMERIC)
RETURNS TABLE (coupon_id UUID, discount_type TEXT, discount_value NUMERIC, discount_amount NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_coupon RECORD; v_amount NUMERIC := 0;
BEGIN
  UPDATE public.coupons c
  SET uses_count = uses_count + 1
  WHERE c.code = p_code AND c.agent_id = p_agent_id AND c.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND (c.max_uses IS NULL OR c.uses_count < c.max_uses)
    AND (c.min_order_amount IS NULL OR p_order_subtotal >= c.min_order_amount)
  RETURNING c.id, c.discount_type::text, c.discount_value INTO v_coupon;

  IF v_coupon.id IS NULL THEN
    RAISE EXCEPTION 'Coupon invalid, expired, or limit reached' USING ERRCODE = 'check_violation';
  END IF;

  IF v_coupon.discount_type = 'percent' THEN
    v_amount := ROUND(p_order_subtotal * v_coupon.discount_value / 100.0, 2);
  ELSE
    v_amount := LEAST(v_coupon.discount_value, p_order_subtotal);
  END IF;

  RETURN QUERY SELECT v_coupon.id, v_coupon.discount_type, v_coupon.discount_value, v_amount;
END;
$$;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(TEXT, UUID, NUMERIC) TO authenticated;

CREATE TABLE IF NOT EXISTS public.cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  partition_key TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed')),
  notes TEXT,
  UNIQUE (job_name, partition_key)
);
ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read cron runs" ON public.cron_runs FOR SELECT USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit log" ON public.admin_audit_log FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins insert audit log" ON public.admin_audit_log FOR INSERT WITH CHECK (public.is_admin());

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key UUID;
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_uniq
  ON public.orders (idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_cart_reminder_at TIMESTAMPTZ;
ALTER TABLE public.agent_profiles ADD COLUMN IF NOT EXISTS warehouse_address JSONB;

CREATE INDEX IF NOT EXISTS profiles_parent_agent_id_idx
  ON public.profiles (parent_agent_id) WHERE parent_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_referring_agent_id_idx
  ON public.profiles (referring_agent_id) WHERE referring_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS statement_orders_statement_id_idx ON public.statement_orders (statement_id);
CREATE INDEX IF NOT EXISTS statement_orders_order_id_idx ON public.statement_orders (order_id);
CREATE INDEX IF NOT EXISTS agent_products_product_id_idx ON public.agent_products (product_id);
CREATE INDEX IF NOT EXISTS coupons_agent_code_idx
  ON public.coupons (agent_id, code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS internal_messages_unread_idx
  ON public.internal_messages (receiver_id, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS disclaimer_acceptances_session_idx
  ON public.disclaimer_acceptances (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS disclaimer_acceptances_user_idx
  ON public.disclaimer_acceptances (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_pending_cleanup_idx
  ON public.orders (created_at) WHERE status = 'pending_customer_payment';
CREATE INDEX IF NOT EXISTS orders_agent_status_idx ON public.orders (agent_id, status);

CREATE OR REPLACE FUNCTION public.cancel_stale_pending_orders(p_hours INT DEFAULT 72)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count INT;
BEGIN
  WITH cancelled AS (
    UPDATE public.orders
    SET status = 'cancelled', updated_at = NOW(),
        agent_approval_notes = COALESCE(agent_approval_notes, '') ||
          ' [Auto-cancelled: payment not received within ' || p_hours || 'h]'
    WHERE status = 'pending_customer_payment'
      AND created_at < NOW() - (p_hours || ' hours')::INTERVAL
    RETURNING id)
  SELECT COUNT(*) INTO v_count FROM cancelled;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cancel_stale_pending_orders(INT) FROM anon, authenticated;

UPDATE public.agent_profiles SET is_active = true WHERE is_active IS NULL;
ALTER TABLE public.agent_profiles ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE public.agent_profiles ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE public.orders ALTER COLUMN buyer_id DROP NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_email TEXT;

CREATE OR REPLACE FUNCTION public.seed_agent_products_for_new_agent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_multiplier NUMERIC; v_tier agent_tier;
BEGIN
  IF NEW.role NOT IN ('agent', 'super_agent') THEN RETURN NEW; END IF;
  v_tier := COALESCE(NEW.tier, 'tier_3');
  SELECT multiplier INTO v_multiplier FROM public.pricing_tiers WHERE tier_name = v_tier;
  IF v_multiplier IS NULL THEN v_multiplier := 7.0; END IF;
  INSERT INTO public.agent_products (agent_id, product_id, retail_price, is_visible, sort_order)
  SELECT NEW.id, p.id, ROUND(p.base_cost * v_multiplier, 2), true, 0
  FROM public.products p
  WHERE p.is_active = true AND COALESCE(p.is_banned, false) = false
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.seed_agent_products_for_new_agent() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.seed_agent_products_for_new_product()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = false OR COALESCE(NEW.is_banned, false) THEN RETURN NEW; END IF;
  INSERT INTO public.agent_products (agent_id, product_id, retail_price, is_visible, sort_order)
  SELECT p.id, NEW.id,
    ROUND(NEW.base_cost * COALESCE(
      (SELECT custom_multiplier FROM public.product_tier_overrides
         WHERE product_id = NEW.id AND tier_name = COALESCE(p.tier, 'tier_3')),
      (SELECT multiplier FROM public.pricing_tiers WHERE tier_name = COALESCE(p.tier, 'tier_3')),
      7.0), 2),
    true, 0
  FROM public.profiles p
  WHERE p.role IN ('agent', 'super_agent')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.seed_agent_products_for_new_product() FROM anon, authenticated;

ALTER FUNCTION public.prevent_banned_product_sale() SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.get_user_role() SET search_path = public;
ALTER FUNCTION public.sync_product_stock_status() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_agent_or_above() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_agent() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_sub_agent_ids(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
