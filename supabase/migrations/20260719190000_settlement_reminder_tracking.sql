-- Settlement reminder tracking for weekly_statements and agent_invoices.
--
-- Mirrors the orders.payment_reminder_count / last_payment_reminder_at
-- pattern added in 20260719120000_order_notifications_and_escalation.sql.
-- The new /api/cron/settlement-reminders job (5 PM Chicago, daily until
-- paid) claims a row - stamping the count/timestamp - BEFORE sending its
-- push, so a crash mid-run that leaves the cron_runs claim retryable can
-- never double-notify a payer already reminded earlier in the same run.
ALTER TABLE public.weekly_statements
  ADD COLUMN IF NOT EXISTS payment_reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_reminder_at timestamptz NULL;

ALTER TABLE public.agent_invoices
  ADD COLUMN IF NOT EXISTS payment_reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_reminder_at timestamptz NULL;
