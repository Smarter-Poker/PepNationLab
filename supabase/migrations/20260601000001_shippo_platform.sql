-- =========================================================================
-- Shippo Platform Account integration — M1 schema
-- =========================================================================
-- Creates 6 new tables (platform_shippo_credentials, shipping_origins,
-- shipping_label_purchases, label_jobs, shipping_tracking_events,
-- shipping_webhook_deliveries) plus legacy_agent_shippo_keys archive.
-- Adds shipping bookkeeping columns to orders and platform/BYO mode columns
-- to agent_profiles. All tables get RLS with admin-only or scoped policies.
-- Append-only audit row (shipping_label_purchases) cannot be UPDATEd or
-- DELETEd outside the SECURITY DEFINER refund RPC. One active row constraints
-- via partial unique indexes.
-- =========================================================================

-- =========================================================================
-- 1. Platform-level Shippo credentials (one active row, admin-managed)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.platform_shippo_credentials (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode                      TEXT NOT NULL CHECK (mode IN ('test','live')),
  api_key_ciphertext        BYTEA NOT NULL,
  api_key_iv                BYTEA NOT NULL,
  api_key_tag               BYTEA NOT NULL,
  api_key_last4             TEXT  NOT NULL,
  webhook_secret_ciphertext BYTEA,
  webhook_secret_iv         BYTEA,
  webhook_secret_tag        BYTEA,
  is_active                 BOOLEAN NOT NULL DEFAULT false,
  connected_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  connected_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_validated_at         TIMESTAMPTZ,
  last_validation_error     TEXT,
  rotated_from              UUID REFERENCES public.platform_shippo_credentials(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_platform_shippo
  ON public.platform_shippo_credentials (is_active) WHERE is_active = true;

ALTER TABLE public.platform_shippo_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_shippo admin select" ON public.platform_shippo_credentials;
CREATE POLICY "platform_shippo admin select" ON public.platform_shippo_credentials
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "platform_shippo admin write" ON public.platform_shippo_credentials;
CREATE POLICY "platform_shippo admin write" ON public.platform_shippo_credentials
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "platform_shippo admin update" ON public.platform_shippo_credentials;
CREATE POLICY "platform_shippo admin update" ON public.platform_shippo_credentials
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "platform_shippo no delete" ON public.platform_shippo_credentials;
CREATE POLICY "platform_shippo no delete" ON public.platform_shippo_credentials
  FOR DELETE USING (false);

-- =========================================================================
-- 2. Master ship-from address book (admin-managed)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.shipping_origins (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label              TEXT NOT NULL,
  name               TEXT NOT NULL,
  company            TEXT,
  street1            TEXT NOT NULL,
  street2            TEXT,
  city               TEXT NOT NULL,
  state              TEXT NOT NULL,
  zip                TEXT NOT NULL,
  country            TEXT NOT NULL DEFAULT 'US',
  phone              TEXT NOT NULL,
  email              TEXT NOT NULL,
  is_default         BOOLEAN NOT NULL DEFAULT false,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  shippo_address_id  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_default_shipping_origin
  ON public.shipping_origins (is_default) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_shipping_origins_active
  ON public.shipping_origins (is_active) WHERE is_active = true;

ALTER TABLE public.shipping_origins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_origins admin all" ON public.shipping_origins;
CREATE POLICY "shipping_origins admin all" ON public.shipping_origins
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =========================================================================
-- 3. Per-label audit ledger (append-only system of record)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.shipping_label_purchases (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  agent_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  origin_id             UUID NOT NULL REFERENCES public.shipping_origins(id) ON DELETE RESTRICT,
  shippo_transaction_id TEXT NOT NULL UNIQUE,
  shippo_rate_id        TEXT,
  shippo_shipment_id    TEXT,
  carrier               TEXT NOT NULL,
  service_level         TEXT NOT NULL,
  tracking_number       TEXT NOT NULL,
  tracking_url_provider TEXT,
  label_url             TEXT NOT NULL,
  label_file_type       TEXT NOT NULL DEFAULT 'PDF_4x6',
  label_cost_cents      INTEGER NOT NULL CHECK (label_cost_cents >= 0),
  agent_charged_cents   INTEGER NOT NULL CHECK (agent_charged_cents >= 0),
  parcel_weight_oz      NUMERIC(8,2) NOT NULL CHECK (parcel_weight_oz > 0),
  parcel_template       TEXT,
  paid_by               TEXT NOT NULL CHECK (paid_by IN ('platform','agent_byo')),
  mode                  TEXT NOT NULL CHECK (mode IN ('test','live')),
  refunded              BOOLEAN NOT NULL DEFAULT false,
  refunded_at           TIMESTAMPTZ,
  refund_cents          INTEGER CHECK (refund_cents IS NULL OR refund_cents >= 0),
  shippo_refund_id      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_label_purchases_order
  ON public.shipping_label_purchases(order_id);
CREATE INDEX IF NOT EXISTS idx_label_purchases_agent_time
  ON public.shipping_label_purchases(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_label_purchases_tracking
  ON public.shipping_label_purchases(tracking_number);
-- One non-refunded purchase per order — second label requires the first be voided
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_label_per_order
  ON public.shipping_label_purchases(order_id) WHERE refunded = false;

ALTER TABLE public.shipping_label_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "label_purchases owner agent select" ON public.shipping_label_purchases;
CREATE POLICY "label_purchases owner agent select" ON public.shipping_label_purchases
  FOR SELECT USING (
    agent_id = (SELECT auth.uid())
    OR public.is_admin()
    OR public.get_user_role() = 'shipping'
  );

-- Admin-only writes; ledger is append-only (no UPDATE, no DELETE)
DROP POLICY IF EXISTS "label_purchases admin insert" ON public.shipping_label_purchases;
CREATE POLICY "label_purchases admin insert" ON public.shipping_label_purchases
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "label_purchases no update" ON public.shipping_label_purchases;
CREATE POLICY "label_purchases no update" ON public.shipping_label_purchases
  FOR UPDATE USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "label_purchases no delete" ON public.shipping_label_purchases;
CREATE POLICY "label_purchases no delete" ON public.shipping_label_purchases
  FOR DELETE USING (false);

-- =========================================================================
-- 4. Label-purchase job queue
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.label_jobs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                 UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  requested_by             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status                   TEXT NOT NULL DEFAULT 'queued'
                           CHECK (status IN ('queued','processing','succeeded','failed','dead')),
  attempts                 INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error               TEXT,
  next_attempt_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  preferred_service_level  TEXT,
  origin_id                UUID REFERENCES public.shipping_origins(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at             TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_label_job_per_order
  ON public.label_jobs(order_id) WHERE status NOT IN ('succeeded','dead');

CREATE INDEX IF NOT EXISTS idx_label_jobs_next_attempt
  ON public.label_jobs(next_attempt_at) WHERE status IN ('queued','processing');

ALTER TABLE public.label_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "label_jobs admin all" ON public.label_jobs;
CREATE POLICY "label_jobs admin all" ON public.label_jobs
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "label_jobs agent select own" ON public.label_jobs;
CREATE POLICY "label_jobs agent select own" ON public.label_jobs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o
      WHERE o.id = label_jobs.order_id
        AND (o.agent_id = (SELECT auth.uid()) OR public.get_user_role() = 'shipping'))
  );

-- =========================================================================
-- 5. Carrier tracking event log
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.shipping_tracking_events (
  id              BIGSERIAL PRIMARY KEY,
  order_id        UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,
  carrier         TEXT,
  status          TEXT NOT NULL,
  substatus       TEXT,
  status_details  TEXT,
  location        JSONB,
  occurred_at     TIMESTAMPTZ NOT NULL,
  raw_payload     JSONB NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_order_time
  ON public.shipping_tracking_events(order_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_events_tracking_number
  ON public.shipping_tracking_events(tracking_number);

ALTER TABLE public.shipping_tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tracking_events buyer agent admin select" ON public.shipping_tracking_events;
CREATE POLICY "tracking_events buyer agent admin select" ON public.shipping_tracking_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o
      WHERE o.id = shipping_tracking_events.order_id
        AND (
          o.buyer_id = (SELECT auth.uid())
          OR o.agent_id = (SELECT auth.uid())
          OR public.is_admin()
          OR public.get_user_role() = 'shipping'
        ))
  );

-- =========================================================================
-- 6. Webhook delivery log (HMAC idempotency + dead-letter)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.shipping_webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shippo_event_id TEXT UNIQUE,
  event_type      TEXT NOT NULL,
  signature_valid BOOLEAN NOT NULL,
  processed       BOOLEAN NOT NULL DEFAULT false,
  dead_lettered   BOOLEAN NOT NULL DEFAULT false,
  error_message   TEXT,
  payload         JSONB NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_unprocessed
  ON public.shipping_webhook_deliveries(received_at)
  WHERE NOT processed AND NOT dead_lettered;

CREATE INDEX IF NOT EXISTS idx_webhook_bad_sig
  ON public.shipping_webhook_deliveries(received_at) WHERE NOT signature_valid;

ALTER TABLE public.shipping_webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook deliveries admin select" ON public.shipping_webhook_deliveries;
CREATE POLICY "webhook deliveries admin select" ON public.shipping_webhook_deliveries
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "webhook deliveries no public write" ON public.shipping_webhook_deliveries;
CREATE POLICY "webhook deliveries no public write" ON public.shipping_webhook_deliveries
  FOR INSERT WITH CHECK (false);

-- Webhook receiver writes via service_role only — RLS is bypassed there.

-- =========================================================================
-- 7. Legacy archive for the per-agent Shippo keys we are deprecating
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.legacy_agent_shippo_keys (
  agent_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  api_key     TEXT NOT NULL,
  archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note        TEXT
);

ALTER TABLE public.legacy_agent_shippo_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legacy_agent_shippo_keys admin only" ON public.legacy_agent_shippo_keys;
CREATE POLICY "legacy_agent_shippo_keys admin only" ON public.legacy_agent_shippo_keys
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =========================================================================
-- 8. orders: shipping bookkeeping columns
-- =========================================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS label_cost_cents     INTEGER
    CHECK (label_cost_cents IS NULL OR label_cost_cents >= 0),
  ADD COLUMN IF NOT EXISTS agent_charged_cents  INTEGER
    CHECK (agent_charged_cents IS NULL OR agent_charged_cents >= 0),
  ADD COLUMN IF NOT EXISTS carrier              TEXT,
  ADD COLUMN IF NOT EXISTS service_level        TEXT,
  ADD COLUMN IF NOT EXISTS delivery_eta         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_paid_by     TEXT
    CHECK (shipping_paid_by IS NULL OR shipping_paid_by IN ('platform','agent_byo','manual')),
  ADD COLUMN IF NOT EXISTS shipping_origin_id   UUID
    REFERENCES public.shipping_origins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON public.orders(tracking_number)
  WHERE tracking_number IS NOT NULL;

-- =========================================================================
-- 9. agent_profiles: platform vs BYO mode + managed account id + origin
-- =========================================================================
ALTER TABLE public.agent_profiles
  ADD COLUMN IF NOT EXISTS shippo_account_mode       TEXT NOT NULL DEFAULT 'platform'
    CHECK (shippo_account_mode IN ('platform','byo')),
  ADD COLUMN IF NOT EXISTS shippo_managed_account_id TEXT,
  ADD COLUMN IF NOT EXISTS warehouse_origin_id       UUID
    REFERENCES public.shipping_origins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_profiles_managed
  ON public.agent_profiles(shippo_managed_account_id)
  WHERE shippo_managed_account_id IS NOT NULL;

-- =========================================================================
-- 10. Refund SECURITY DEFINER RPC — only way to mutate
-- shipping_label_purchases after insert (refund flip)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.shippo_record_refund(
  p_purchase_id      UUID,
  p_shippo_refund_id TEXT,
  p_refund_cents     INTEGER
) RETURNS public.shipping_label_purchases
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.shipping_label_purchases;
BEGIN
  IF NOT (public.is_admin() OR public.get_user_role() = 'shipping') THEN
    RAISE EXCEPTION 'Not authorized to record Shippo refund';
  END IF;

  IF p_refund_cents IS NULL OR p_refund_cents < 0 THEN
    RAISE EXCEPTION 'Invalid refund_cents';
  END IF;

  UPDATE public.shipping_label_purchases
  SET refunded         = true,
      refunded_at      = now(),
      refund_cents     = p_refund_cents,
      shippo_refund_id = p_shippo_refund_id
  WHERE id = p_purchase_id
    AND refunded = false
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Label purchase % not found or already refunded', p_purchase_id;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.shippo_record_refund(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shippo_record_refund(UUID, TEXT, INTEGER) TO authenticated;

-- =========================================================================
-- 11. enqueueLabelJob helper SECURITY DEFINER RPC — idempotent
-- =========================================================================
CREATE OR REPLACE FUNCTION public.shippo_enqueue_label_job(
  p_order_id                UUID,
  p_preferred_service_level TEXT DEFAULT NULL,
  p_origin_id               UUID DEFAULT NULL
) RETURNS public.label_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_job   public.label_jobs;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF NOT (
    public.is_admin()
    OR public.get_user_role() = 'shipping'
    OR v_order.agent_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized to enqueue label for this order';
  END IF;

  SELECT * INTO v_job FROM public.label_jobs
   WHERE order_id = p_order_id AND status NOT IN ('succeeded','dead')
   LIMIT 1;

  IF v_job.id IS NOT NULL THEN
    RETURN v_job;
  END IF;

  INSERT INTO public.label_jobs (order_id, requested_by, preferred_service_level, origin_id)
  VALUES (p_order_id, (SELECT auth.uid()), p_preferred_service_level, p_origin_id)
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.shippo_enqueue_label_job(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shippo_enqueue_label_job(UUID, TEXT, UUID) TO authenticated;

-- =========================================================================
-- 12. updated_at trigger for shipping_origins
-- =========================================================================
CREATE OR REPLACE FUNCTION public.shipping_origins_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shipping_origins_updated_at ON public.shipping_origins;
CREATE TRIGGER trg_shipping_origins_updated_at
  BEFORE UPDATE ON public.shipping_origins
  FOR EACH ROW EXECUTE FUNCTION public.shipping_origins_touch_updated_at();

-- =========================================================================
-- Done.
-- =========================================================================
