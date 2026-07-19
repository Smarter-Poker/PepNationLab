-- Weekly settlement reminders (2026-07-19): invoices/statements generate Monday
-- after the Sunday 11:59:59 PM CT week close and are paid manually. A new 5 PM
-- Chicago daily cron nudges unpaid payers (first push Monday 5 PM per Dan).
-- These columns track that reminder ladder per statement/invoice.
-- Applied to production 2026-07-19.
ALTER TABLE public.weekly_statements
  ADD COLUMN IF NOT EXISTS payment_reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_reminder_at timestamptz NULL;
ALTER TABLE public.agent_invoices
  ADD COLUMN IF NOT EXISTS payment_reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_reminder_at timestamptz NULL;
