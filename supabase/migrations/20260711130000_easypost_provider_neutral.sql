-- ============================================================================
-- 20260711130000_easypost_provider_neutral.sql
--
-- Shippo -> EasyPost gut job, provider-neutral schema.
--
-- The Shippo integration is retired. The platform shipping provider is now
-- EasyPost (lib/shipping.ts). This migration renames every shippo_* table,
-- column, and function to a provider-neutral name so a future provider swap
-- is configuration, not another schema rewrite. Historical Shippo rows are
-- preserved and tagged provider = 'shippo'.
--
--   1. platform_shippo_credentials  -> shipping_provider_credentials (+ provider)
--   2. shippo_webhook_events        -> shipping_webhook_events       (+ provider)
--   3. shipping_label_purchases     -> shippo_* columns -> provider_* (+ provider)
--   4. label_jobs                   -> shippo_transaction_id -> provider_transaction_id
--   5. shipping_origins             -> shippo_address_id -> provider_address_id
--   6. shipping_webhook_deliveries  -> shippo_event_id -> provider_event_id
--   7. Functions shippo_record_refund / shippo_enqueue_label_job renamed to
--      shipping_record_refund / shipping_enqueue_label_job (bodies updated to
--      the new column names); autolock sensitive list updated first so the
--      event trigger re-locks the new names on CREATE.
--   8. Legacy per-agent keys dropped: legacy_agent_shippo_keys table and
--      agent_profiles.shippo_api_key column (shipping is platform-managed).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Platform credentials table
-- ----------------------------------------------------------------------------
ALTER TABLE public.platform_shippo_credentials RENAME TO shipping_provider_credentials;

ALTER TABLE public.shipping_provider_credentials
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'easypost';

-- Every pre-existing row is a Shippo key: tag it and deactivate it. A Shippo
-- token is useless against the EasyPost API and must never be selected as the
-- active credential by the new code.
UPDATE public.shipping_provider_credentials
   SET provider = 'shippo',
       is_active = false;

-- ----------------------------------------------------------------------------
-- 2. Webhook events table
-- ----------------------------------------------------------------------------
ALTER TABLE public.shippo_webhook_events RENAME TO shipping_webhook_events;

ALTER TABLE public.shipping_webhook_events
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'easypost';

UPDATE public.shipping_webhook_events SET provider = 'shippo';

-- ----------------------------------------------------------------------------
-- 3. Label purchase ledger columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.shipping_label_purchases RENAME COLUMN shippo_transaction_id TO provider_transaction_id;
ALTER TABLE public.shipping_label_purchases RENAME COLUMN shippo_rate_id        TO provider_rate_id;
ALTER TABLE public.shipping_label_purchases RENAME COLUMN shippo_shipment_id    TO provider_shipment_id;
ALTER TABLE public.shipping_label_purchases RENAME COLUMN shippo_refund_id      TO provider_refund_id;

ALTER TABLE public.shipping_label_purchases
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'easypost';

-- Any pre-existing ledger rows were bought through Shippo.
UPDATE public.shipping_label_purchases SET provider = 'shippo';

-- ----------------------------------------------------------------------------
-- 4. Label jobs
-- ----------------------------------------------------------------------------
ALTER TABLE public.label_jobs RENAME COLUMN shippo_transaction_id TO provider_transaction_id;

-- ----------------------------------------------------------------------------
-- 5. Shipping origins
-- ----------------------------------------------------------------------------
ALTER TABLE public.shipping_origins RENAME COLUMN shippo_address_id TO provider_address_id;

-- Provider address ids are Shippo object ids; they mean nothing to EasyPost.
-- Clear them so the next validation writes a fresh EasyPost id.
UPDATE public.shipping_origins SET provider_address_id = NULL;

-- ----------------------------------------------------------------------------
-- 6. Webhook deliveries (legacy audit table, kept for history)
-- ----------------------------------------------------------------------------
ALTER TABLE public.shipping_webhook_deliveries RENAME COLUMN shippo_event_id TO provider_event_id;

-- ----------------------------------------------------------------------------
-- 7a. Update the autolock sensitive-function list FIRST so the event trigger
--     re-locks the renamed functions the moment they are created below.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._autolock_privileged_functions()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  obj record;
  sensitive text[] := ARRAY[
    'wallet_transfer','deduct_prepaid_balance','refund_prepaid_balance','credit_prepaid_balance',
    'charge_order_credit_line','charge_credit_line','reverse_order_credit_charge','super_credit_agent_balance',
    'admin_credit_account','issue_store_credit','issue_refund','redeem_store_credit','release_store_credit',
    'cancel_order','settle_sub_agent_week','pay_weekly_statement','redeem_coupon','unredeem_coupon',
    'reserve_inventory','release_inventory','fn_admin_search_orders','fn_provisioned_accounts',
    'shipping_record_refund','shipping_enqueue_label_job','decide_credit_increase','consume_slug_reservation',
    'cancel_stale_pending_orders','coupons_daily_expiry_sweep','apply_due_price_changes',
    'upsert_agent_invoice_atomic','accrue_sub_agent_commission','fulfil_researcher_referral',
    'resolve_statement_dispute','refresh_recommendation_views','refresh_compound_search'
  ];
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE object_type = 'function' LOOP
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.oid = obj.objid AND n.nspname = 'public' AND p.proname = ANY(sensitive)
      ) THEN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', obj.object_identity);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', obj.object_identity);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.audit_log (event_type, event_data, created_at)
      VALUES ('autolock_failure', jsonb_build_object('fn', obj.object_identity, 'err', SQLERRM), now());
    END;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.audit_log (event_type, event_data, created_at)
  VALUES ('autolock_global_failure', jsonb_build_object('err', SQLERRM), now());
END $function$;

-- ----------------------------------------------------------------------------
-- 7b. shipping_record_refund (was shippo_record_refund)
--     Same authz, locking, and audit semantics; new column names; param
--     p_provider_refund_id (was p_shippo_refund_id).
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.shippo_record_refund(uuid, integer, text, text, uuid);

CREATE OR REPLACE FUNCTION public.shipping_record_refund(
  p_label_purchase_id uuid,
  p_refund_amount_cents integer,
  p_provider_refund_id text DEFAULT NULL,
  p_reason text DEFAULT 'admin_refund',
  p_initiated_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row public.shipping_label_purchases%ROWTYPE;
BEGIN
  -- AuthZ: only admins and the shipping role may record refunds.
  IF NOT (public.is_admin() OR public.get_user_role() = 'shipping') THEN
    RAISE EXCEPTION 'Not authorized to record label refund';
  END IF;

  IF p_refund_amount_cents IS NULL OR p_refund_amount_cents < 0 THEN
    RAISE EXCEPTION 'Invalid refund amount';
  END IF;

  -- Lock the candidate row so a parallel refund call cannot race past the
  -- refunded=false predicate. Skip if already refunded.
  SELECT * INTO v_row
  FROM public.shipping_label_purchases
  WHERE id = p_label_purchase_id
    AND refunded = false
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Label purchase % not found or already refunded', p_label_purchase_id;
  END IF;

  UPDATE public.shipping_label_purchases
  SET refunded           = true,
      refunded_at        = now(),
      refund_cents       = p_refund_amount_cents,
      provider_refund_id = p_provider_refund_id
  WHERE id = p_label_purchase_id;

  -- Forensic audit row so we have a paper trail for every refund. The route
  -- handler also writes its own row, but this is the source-of-truth for
  -- "this RPC ran" so admins can detect refunds that bypassed the UI.
  INSERT INTO public.admin_audit_log (
    actor_id,
    action,
    entity_type,
    entity_id,
    changes
  ) VALUES (
    p_initiated_by,
    'shipping_record_refund_rpc',
    'shipping_label_purchases',
    p_label_purchase_id,
    jsonb_build_object(
      'order_id', v_row.order_id,
      'agent_id', v_row.agent_id,
      'provider_transaction_id', v_row.provider_transaction_id,
      'refund_amount_cents', p_refund_amount_cents,
      'provider_refund_id', p_provider_refund_id,
      'reason', p_reason
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.shipping_record_refund(uuid, integer, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shipping_record_refund(uuid, integer, text, text, uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 7c. shipping_enqueue_label_job (was shippo_enqueue_label_job)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.shippo_enqueue_label_job(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.shipping_enqueue_label_job(
  p_order_id uuid,
  p_preferred_service_level text DEFAULT NULL,
  p_origin_id uuid DEFAULT NULL
)
RETURNS label_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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

  -- Idempotent: return existing non-terminal job.
  SELECT * INTO v_job FROM public.label_jobs
   WHERE order_id = p_order_id AND status NOT IN ('succeeded','dead')
   LIMIT 1;

  IF v_job.id IS NOT NULL THEN
    RETURN v_job;
  END IF;

  -- Write both column names so the cron can read either.
  INSERT INTO public.label_jobs (
    order_id, requested_by,
    preferred_service_level, service_level_token,
    origin_id
  ) VALUES (
    p_order_id, (SELECT auth.uid()),
    p_preferred_service_level, p_preferred_service_level,
    p_origin_id
  )
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$function$;

REVOKE ALL ON FUNCTION public.shipping_enqueue_label_job(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shipping_enqueue_label_job(uuid, text, uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 8. Drop the legacy per-agent key surface. Shipping is platform-managed;
--    per-agent carrier keys no longer exist anywhere in the codebase.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.legacy_agent_shippo_keys;

ALTER TABLE public.agent_profiles DROP COLUMN IF EXISTS shippo_api_key;
ALTER TABLE public.agent_profiles DROP COLUMN IF EXISTS shippo_account_mode;
ALTER TABLE public.agent_profiles DROP COLUMN IF EXISTS shippo_managed_account_id;
