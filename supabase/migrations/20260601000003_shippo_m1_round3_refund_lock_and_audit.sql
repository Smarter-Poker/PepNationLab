-- ----------------------------------------------------------------------------
-- Shippo M1 round-3 audit fixes
--
--   1. Add the missing index on shipping_label_purchases.label_job_id so the
--      webhook handler join (WHERE label_job_id = job.id) does not seq-scan.
--   2. Replace shippo_record_refund so it (a) locks the row with FOR UPDATE
--      before flipping refunded=true, eliminating the read-after-write race
--      under concurrent refund clicks, and (b) writes an admin_audit_log row
--      with the p_reason and p_initiated_by inputs that were previously
--      dropped on the floor.
--
-- All other M1 RPC contracts and CHECK constraints remain unchanged.
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_shipping_label_purchases_label_job_id
  ON public.shipping_label_purchases (label_job_id)
  WHERE label_job_id IS NOT NULL;

-- Drop and recreate with the lock + audit. The signature is unchanged so all
-- callers continue to work.
DROP FUNCTION IF EXISTS public.shippo_record_refund(uuid, integer, text, text, uuid);

CREATE OR REPLACE FUNCTION public.shippo_record_refund(
  p_label_purchase_id uuid,
  p_refund_amount_cents integer,
  p_shippo_refund_id text DEFAULT NULL,
  p_reason text DEFAULT 'admin_refund',
  p_initiated_by uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.shipping_label_purchases%ROWTYPE;
BEGIN
  -- AuthZ: only admins and the shipping role may record refunds.
  IF NOT (public.is_admin() OR public.get_user_role() = 'shipping') THEN
    RAISE EXCEPTION 'Not authorized to record Shippo refund';
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
  SET refunded         = true,
      refunded_at      = now(),
      refund_cents     = p_refund_amount_cents,
      shippo_refund_id = p_shippo_refund_id
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
    'shippo_record_refund_rpc',
    'shipping_label_purchases',
    p_label_purchase_id,
    jsonb_build_object(
      'order_id', v_row.order_id,
      'agent_id', v_row.agent_id,
      'shippo_transaction_id', v_row.shippo_transaction_id,
      'refund_amount_cents', p_refund_amount_cents,
      'shippo_refund_id', p_shippo_refund_id,
      'reason', p_reason
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.shippo_record_refund(uuid, integer, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shippo_record_refund(uuid, integer, text, text, uuid) TO authenticated;
