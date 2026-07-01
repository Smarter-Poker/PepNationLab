-- 20260701070001_upsert_agent_invoice_atomic_rpc.sql
-- Atomically upserts an agent invoice, ensuring we never overwrite the status of a 'paid' invoice.

CREATE OR REPLACE FUNCTION public.upsert_agent_invoice_atomic(
  p_super_agent_id uuid,
  p_agent_id uuid,
  p_week_start date,
  p_week_end date,
  p_total_cogs numeric,
  p_total_shipping numeric,
  p_total_owed numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice_id uuid;
BEGIN
  INSERT INTO public.agent_invoices (
    super_agent_id,
    agent_id,
    week_start,
    week_end,
    total_cogs,
    total_shipping,
    total_owed,
    status,
    updated_at
  ) VALUES (
    p_super_agent_id,
    p_agent_id,
    p_week_start,
    p_week_end,
    p_total_cogs,
    p_total_shipping,
    p_total_owed,
    'open',
    now()
  )
  ON CONFLICT (agent_id, week_start) DO UPDATE
  SET
    total_cogs = EXCLUDED.total_cogs,
    total_shipping = EXCLUDED.total_shipping,
    total_owed = EXCLUDED.total_owed,
    updated_at = EXCLUDED.updated_at
  WHERE agent_invoices.status != 'paid'
  RETURNING id INTO v_invoice_id;

  -- If it wasn't returned, it means it existed and was paid (so the DO UPDATE WHERE clause filtered it out)
  IF v_invoice_id IS NULL THEN
    SELECT id INTO v_invoice_id
    FROM public.agent_invoices
    WHERE agent_id = p_agent_id
      AND week_start = p_week_start;
  END IF;

  RETURN v_invoice_id;
END;
$$;
