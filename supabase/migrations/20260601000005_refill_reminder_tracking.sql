-- Global 21-day refill / reorder reminder drip.
-- Tracks when a refill reminder was sent for an order so the daily cron is
-- idempotent and never double-messages a buyer.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refill_reminder_sent_at timestamptz;

-- Partial index: the cron only ever scans fulfilled, not-yet-reminded orders
-- within a recent created_at window. Keeping the index partial keeps it tiny.
CREATE INDEX IF NOT EXISTS idx_orders_refill_due
  ON public.orders (created_at)
  WHERE refill_reminder_sent_at IS NULL;

COMMENT ON COLUMN public.orders.refill_reminder_sent_at IS
  'Set by /api/cron/refill-reminders when the 21-day reorder reminder (push + messenger DM) has been delivered for this order. NULL means not yet reminded.';
