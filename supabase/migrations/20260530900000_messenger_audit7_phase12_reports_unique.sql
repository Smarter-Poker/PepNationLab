-- Audit7 Phase 12 hardening: prevent duplicate reports.
--
-- Add UNIQUE(message_id, reporter_id) to messenger_reports so the same
-- reporter cannot spam-create multiple open reports against the same
-- message. The previous schema had three btree indexes on the table but
-- no uniqueness guarantee, so a user could click Report -> Submit ten
-- times and the admin moderation surface would show ten duplicate rows
-- for the same (message, reporter) pair.
--
-- The constraint is enforced at the DB so callers cannot bypass it. The
-- API route (/api/messenger/report-message) catches the resulting 23505
-- and returns HTTP 409 with { error: 'Already Reported' }, which the
-- ReportModal closes on.
--
-- IF NOT EXISTS guards against re-apply; we also dedupe any pre-existing
-- duplicate rows in the same DO block so the index creation cannot fail
-- mid-roll on a legacy dataset.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_mrpt_message_reporter'
  ) THEN
    -- Drop any duplicate rows first so the index creation cannot fail.
    -- Keeps the lowest id per (message_id, reporter_id) and removes the rest.
    DELETE FROM public.messenger_reports r
    USING public.messenger_reports r2
    WHERE r.message_id = r2.message_id
      AND r.reporter_id = r2.reporter_id
      AND r.id > r2.id;

    CREATE UNIQUE INDEX uq_mrpt_message_reporter
      ON public.messenger_reports (message_id, reporter_id);
  END IF;
END$$;
