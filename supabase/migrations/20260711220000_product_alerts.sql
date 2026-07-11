-- Product Alerts: back-in-stock and price-drop notifications.
--
-- A researcher subscribes to a product; a cron (/api/cron/product-alerts)
-- dispatches an email when the product's master inventory returns to stock, or
-- when the effective storefront price drops below the price captured at
-- subscribe time. Enhancement roadmap Phase B, item 4.

CREATE TABLE IF NOT EXISTS public.product_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  -- Storefront context (whose store the researcher was on). Optional: a
  -- back-in-stock alert is product-level; a price-drop alert is agent-scoped.
  agent_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  alert_type      TEXT NOT NULL DEFAULT 'back_in_stock'
                    CHECK (alert_type IN ('back_in_stock', 'price_drop')),
  -- Effective price observed when the researcher subscribed (price_drop only).
  reference_price NUMERIC,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'notified', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at     TIMESTAMPTZ,
  -- One active subscription per researcher / product / type. Re-subscribing
  -- upserts (reactivates) the same row.
  UNIQUE (user_id, product_id, alert_type)
);

CREATE INDEX IF NOT EXISTS product_alerts_active_product_idx
  ON public.product_alerts (product_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS product_alerts_user_idx
  ON public.product_alerts (user_id, created_at DESC);

ALTER TABLE public.product_alerts ENABLE ROW LEVEL SECURITY;

-- Researchers manage only their own alerts.
DROP POLICY IF EXISTS "Users manage own product alerts" ON public.product_alerts;
CREATE POLICY "Users manage own product alerts" ON public.product_alerts
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Admins may read all (support / analytics). The dispatch cron uses the
-- service-role client, which bypasses RLS.
DROP POLICY IF EXISTS "Admin read product alerts" ON public.product_alerts;
CREATE POLICY "Admin read product alerts" ON public.product_alerts
  FOR SELECT
  USING (public.is_admin());
