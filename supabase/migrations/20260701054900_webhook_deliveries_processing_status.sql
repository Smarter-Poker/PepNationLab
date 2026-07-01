-- Add 'processing' to webhook_deliveries status constraint.
--
-- The webhooks-dispatch cron now atomically flips rows from
-- 'pending' → 'processing' before attempting delivery to prevent
-- duplicate sends when two cron invocations overlap. The original
-- CHECK constraint only allowed ('pending','sent','failed','expired'),
-- so we drop and recreate it to include 'processing'.
--
-- Also adds 'delivered' as an alias for 'sent' (the cron uses
-- 'delivered' internally; 'sent' is the original value).

ALTER TABLE public.webhook_deliveries
  DROP CONSTRAINT IF EXISTS webhook_deliveries_status_check;

ALTER TABLE public.webhook_deliveries
  ADD CONSTRAINT webhook_deliveries_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'failed', 'expired'));
