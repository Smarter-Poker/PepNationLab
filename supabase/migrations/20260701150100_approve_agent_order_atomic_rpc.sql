-- Migration: approve_agent_order_atomic_rpc
-- Fixes BUG 8: non-atomic prepaid deduction + order status update in
-- app/api/agent/orders/approve/route.ts. Previously these were two separate
-- DB round-trips; a crash between them could deduct money but leave the order
-- in agent_approval_pending with no way to recover automatically.
--
-- This RPC wraps both in a single transaction. If either step fails, both roll back.
-- The route can call this instead of the two-step pattern.

CREATE OR REPLACE FUNCTION approve_agent_order_atomic(
  p_order_id     uuid,
  p_agent_id     uuid,       -- the billing agent (may differ from order.agent_id for super-agent billing)
  p_amount       numeric,    -- amount to deduct from prepaid balance (0 for credit accounts)
  p_new_status   text,       -- e.g. 'admin_approval_pending' or 'approved_ship'
  p_tracking_no  text  DEFAULT NULL,
  p_approved_at  timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_before numeric;
  v_balance_after  numeric;
BEGIN
  -- ── Step 1: deduct prepaid balance (if amount > 0) ───────────────────────
  IF p_amount > 0 THEN
    -- Lock the balance row to prevent concurrent deductions
    SELECT prepaid_balance
      INTO v_balance_before
      FROM profiles
     WHERE id = p_agent_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'agent_not_found');
    END IF;

    IF v_balance_before < p_amount THEN
      RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance');
    END IF;

    v_balance_after := v_balance_before - p_amount;

    UPDATE profiles
       SET prepaid_balance = v_balance_after,
           updated_at      = now()
     WHERE id = p_agent_id;

    -- Record the balance transaction
    INSERT INTO balance_transactions (
      agent_id, type, amount,
      balance_before, balance_after,
      description, reference_id, reference_type
    ) VALUES (
      p_agent_id, 'order_debit', p_amount,
      v_balance_before, v_balance_after,
      'Prepaid debit for order approval (atomic)',
      p_order_id, 'order'
    );
  END IF;

  -- ── Step 2: update order status ───────────────────────────────────────────
  UPDATE orders
     SET status           = p_new_status,
         agent_approved_at = p_approved_at,
         tracking_number  = COALESCE(p_tracking_no, tracking_number),
         updated_at       = now()
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    -- Order disappeared between read and update — roll back everything above
    RAISE EXCEPTION 'order_not_found';
  END IF;

  RETURN jsonb_build_object('ok', true);

EXCEPTION WHEN OTHERS THEN
  -- Any exception rolls back the entire transaction (balance + order update)
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Grant execute to the service role (used by createServiceClient in Next.js)
GRANT EXECUTE ON FUNCTION approve_agent_order_atomic(uuid, uuid, numeric, text, text, timestamptz)
  TO service_role;

COMMENT ON FUNCTION approve_agent_order_atomic IS
  'Atomically deducts agent prepaid balance and updates order status in a single '
  'transaction. Eliminates the TOCTOU window in the two-step approve flow. '
  'Returns {ok: true} on success or {ok: false, error: string} on failure.';
