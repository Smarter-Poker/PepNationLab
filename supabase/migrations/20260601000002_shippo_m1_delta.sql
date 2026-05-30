-- =========================================================================
-- Shippo Platform Account — M1 delta (Tickets 7-12 supplement)
-- =========================================================================
-- 1.  Reconcile label_jobs status values  (add 'pending' alias, keep 'queued')
-- 2.  Add agent_id + columns the cron sets (shippo_transaction_id, label_url,
--     tracking_number, label_file_type, service_level_token, agent_charged_cents)
--     to label_jobs so the cron can write them without a separate RPC.
-- 3.  Create shippo_webhook_events (dedup table for inbound Shippo events).
-- 4.  Broaden shippo_record_refund signature to match the API call shape.
-- 5.  Create shippo_label_purchases view alias columns so the quote/reconcile
--     routes' column names resolve.
-- =========================================================================

-- =========================================================================
-- 1. label_jobs — status 'pending' + extra columns
-- =========================================================================

-- Allow 'pending' as a status value (alias for 'queued' during cron pickup).
ALTER TABLE public.label_jobs
  DROP CONSTRAINT IF EXISTS label_jobs_status_check;

ALTER TABLE public.label_jobs
  ADD CONSTRAINT label_jobs_status_check
    CHECK (status IN ('pending','queued','processing','succeeded','failed','dead'));

-- Make queued rows match the cron's expected 'pending' value:
-- (existing rows are 'queued'; the cron filters on 'pending')
-- We unify: cron will check for both 'pending' AND 'queued' — OR — just
-- rename default to 'pending'. Easiest: change default and let new inserts
-- use 'pending'. Existing 'queued' rows stay compatible because the cron
-- now selects BOTH.
ALTER TABLE public.label_jobs
  ALTER COLUMN status SET DEFAULT 'pending';

-- Extra columns written by the cron / API:
ALTER TABLE public.label_jobs
  ADD COLUMN IF NOT EXISTS agent_id               UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_level_token    TEXT,
  ADD COLUMN IF NOT EXISTS label_file_type        TEXT NOT NULL DEFAULT 'PDF_4x6',
  ADD COLUMN IF NOT EXISTS shippo_transaction_id  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS label_url              TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number        TEXT,
  ADD COLUMN IF NOT EXISTS agent_charged_cents    INTEGER CHECK (agent_charged_cents IS NULL OR agent_charged_cents >= 0),
  ADD COLUMN IF NOT EXISTS from_address           JSONB,
  ADD COLUMN IF NOT EXISTS parcel                 JSONB,
  ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_label_jobs_pending_attempts
  ON public.label_jobs(created_at)
  WHERE status IN ('pending','queued') AND attempts < 3;

-- =========================================================================
-- 2. shippo_webhook_events — inbound Shippo event dedup
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.shippo_webhook_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         TEXT NOT NULL UNIQUE,   -- Shippo's own event_id for dedup
  event_type       TEXT NOT NULL,
  payload          JSONB NOT NULL DEFAULT '{}',
  processing_error TEXT,
  processed_at     TIMESTAMPTZ,
  received_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shippo_webhook_events_unprocessed
  ON public.shippo_webhook_events(received_at)
  WHERE processed_at IS NULL AND processing_error IS NULL;

ALTER TABLE public.shippo_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shippo_webhook_events admin select" ON public.shippo_webhook_events;
CREATE POLICY "shippo_webhook_events admin select" ON public.shippo_webhook_events
  FOR SELECT USING (public.is_admin());

-- Writes only via service_role in the webhook handler (bypasses RLS).

-- =========================================================================
-- 3. shipping_label_purchases — add label_job_id FK so the reconcile
--    can join and the ledger update in the webhook can find by label_job.
-- =========================================================================
ALTER TABLE public.shipping_label_purchases
  ADD COLUMN IF NOT EXISTS label_job_id         UUID
    REFERENCES public.label_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS label_amount_cents    INTEGER
    CHECK (label_amount_cents IS NULL OR label_amount_cents >= 0);

-- Make origin_id and agent_id nullable so the cron path (which may not
-- always have an origin_id row yet) can still insert.
ALTER TABLE public.shipping_label_purchases
  ALTER COLUMN origin_id DROP NOT NULL,
  ALTER COLUMN agent_id  DROP NOT NULL;

-- =========================================================================
-- 4. shippo_record_refund — extend signature with label_purchase_id alias,
--    reason and initiated_by.  Replace the function entirely.
-- =========================================================================
DROP FUNCTION IF EXISTS public.shippo_record_refund(UUID, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.shippo_record_refund(
  p_label_purchase_id UUID,
  p_refund_amount_cents INTEGER,
  p_shippo_refund_id  TEXT    DEFAULT NULL,
  p_reason            TEXT    DEFAULT 'admin_refund',
  p_initiated_by      UUID    DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_admin() OR public.get_user_role() = 'shipping') THEN
    RAISE EXCEPTION 'Not authorized to record Shippo refund';
  END IF;

  IF p_refund_amount_cents IS NULL OR p_refund_amount_cents < 0 THEN
    RAISE EXCEPTION 'Invalid refund_amount_cents: %', p_refund_amount_cents;
  END IF;

  UPDATE public.shipping_label_purchases
  SET refunded         = true,
      refunded_at      = now(),
      refund_cents     = p_refund_amount_cents,
      shippo_refund_id = p_shippo_refund_id
  WHERE id = p_label_purchase_id
    AND refunded = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Label purchase % not found or already refunded', p_label_purchase_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.shippo_record_refund(UUID, INTEGER, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shippo_record_refund(UUID, INTEGER, TEXT, TEXT, UUID) TO authenticated;

-- =========================================================================
-- 5. Cron runs table must have a summary column (finishCronRun writes it).
--    Check it exists — the push-dispatch migration likely already added it.
-- =========================================================================
ALTER TABLE public.cron_runs
  ADD COLUMN IF NOT EXISTS summary TEXT;

-- =========================================================================
-- Done.
-- =========================================================================
