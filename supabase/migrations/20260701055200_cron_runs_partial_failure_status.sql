-- Add 'partial_failure' to cron_runs status constraint.
--
-- Wave-5 fix to shippo-webhook-retry now sets status='partial_failure'
-- when some rows still fail to reprocess (recovered > 0 but stillFailing > 0).
-- The original CHECK constraint only allowed ('running','succeeded','failed'),
-- causing DB errors on partial failure updates. Widen to include
-- 'partial_failure'.

ALTER TABLE public.cron_runs
  DROP CONSTRAINT IF EXISTS cron_runs_status_check;

ALTER TABLE public.cron_runs
  ADD CONSTRAINT cron_runs_status_check
  CHECK (status IN ('running', 'succeeded', 'failed', 'partial_failure'));
