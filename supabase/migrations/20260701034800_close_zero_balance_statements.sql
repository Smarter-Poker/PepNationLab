-- Fix: retroactively close zero-balance weekly statements.
--
-- These were created by the cron job / manual generation before the
-- auto-close logic was added to persistStatement(). They have total_owed = 0
-- (or negative) but still sit in open/pending_payment status, causing them
-- to appear as outstanding invoices in the admin panel, agent wallets, and
-- balance queries everywhere.
--
-- We mark them paid immediately with payment_method = 'zero_balance' so the
-- ledger stays clean and no actual money movement is implied.

UPDATE weekly_statements
SET
  status             = 'paid',
  paid_at            = NOW(),
  payment_method     = 'zero_balance',
  payment_reference  = 'Auto-closed: no balance due'
WHERE
  status IN ('open', 'pending_payment')
  AND (total_owed IS NULL OR total_owed <= 0);
