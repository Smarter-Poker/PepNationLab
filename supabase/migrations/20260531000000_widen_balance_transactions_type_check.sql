-- 20260531000000_widen_balance_transactions_type_check.sql
--
-- The admin transactions route (POST /api/admin/transactions) and the SACA
-- weekly sub-agent commission-settlement cron insert ledger rows with types
-- (commission, withdrawal, payout, bonus, deposit, restock_charge,
-- manual_adjustment) that the original narrow CHECK rejected. That mismatch
-- caused silent 500s on admin manual ledger entries and would have failed
-- commission settlement at the DB layer.
--
-- Widen the CHECK to the full union of system-internal and admin-creatable
-- ledger types. Widening is non-breaking: every previously valid type remains
-- valid.

ALTER TABLE public.balance_transactions
  DROP CONSTRAINT IF EXISTS balance_transactions_type_check;

ALTER TABLE public.balance_transactions
  ADD CONSTRAINT balance_transactions_type_check
  CHECK (type = ANY (ARRAY[
    'credit','debit','order_charge','statement_payment','initial_deposit','adjustment',
    'commission','withdrawal','restock_charge','bonus','payout','deposit','manual_adjustment'
  ]::text[]));
