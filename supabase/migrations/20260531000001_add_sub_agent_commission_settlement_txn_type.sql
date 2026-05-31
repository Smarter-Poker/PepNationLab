-- 20260531000001_add_sub_agent_commission_settlement_txn_type.sql
--
-- Secondary-sweep finding (2026-05-31): the settle_sub_agent_week() RPC inserts
-- balance_transactions rows with type='sub_agent_commission_settlement'. The
-- prior CHECK (20260531000000) widened the allowed set but did not include this
-- exact literal, so the weekly SACA commission-settlement transaction rolled
-- back on every run and sub-agents were never credited.
--
-- Add the missing type. balance_transactions is currently empty, so this is
-- fully non-breaking.

ALTER TABLE public.balance_transactions
  DROP CONSTRAINT IF EXISTS balance_transactions_type_check;

ALTER TABLE public.balance_transactions
  ADD CONSTRAINT balance_transactions_type_check
  CHECK (type = ANY (ARRAY[
    'credit','debit','order_charge','statement_payment','initial_deposit','adjustment',
    'commission','withdrawal','restock_charge','bonus','payout','deposit','manual_adjustment',
    'sub_agent_commission_settlement'
  ]::text[]));
