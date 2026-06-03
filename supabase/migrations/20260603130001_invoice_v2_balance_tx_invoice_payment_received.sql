-- Invoice v2 sweep 2 — pay_invoice RPC writes balance_transactions with
-- type='invoice_payment_received', but the existing CHECK constraint did
-- not allow that value. Every Pay Now call would have failed with a
-- CHECK violation (the RPC had never been called in production yet
-- because no invoices had generated, so the bug was latent).
--
-- Add the new value to the constraint by dropping + re-adding it (the
-- only supported PG operation on a table CHECK).

ALTER TABLE public.balance_transactions
  DROP CONSTRAINT IF EXISTS balance_transactions_type_check;

ALTER TABLE public.balance_transactions
  ADD CONSTRAINT balance_transactions_type_check CHECK (type = ANY (ARRAY[
    'credit'::text,
    'debit'::text,
    'order_charge'::text,
    'statement_payment'::text,
    'initial_deposit'::text,
    'adjustment'::text,
    'commission'::text,
    'withdrawal'::text,
    'restock_charge'::text,
    'bonus'::text,
    'payout'::text,
    'deposit'::text,
    'manual_adjustment'::text,
    'transfer_in'::text,
    'transfer_out'::text,
    'transfer_out_credit'::text,
    'invoice_payment_received'::text
  ]));

-- Self-assertion — make sure the constraint actually now accepts the new value.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'balance_transactions_type_check'
      AND pg_get_constraintdef(oid) LIKE '%invoice_payment_received%'
  ) THEN
    RAISE EXCEPTION 'invoice_payment_received was not added to balance_transactions_type_check';
  END IF;
END $$;
