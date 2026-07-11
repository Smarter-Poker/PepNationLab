-- Performance: additive covering indexes for the unindexed foreign keys flagged
-- by the Supabase performance advisor (2026-07-11). All IF NOT EXISTS and purely
-- additive -- no data mutation, safe to run repeatedly. These speed up joins and
-- the ON DELETE/UPDATE referential-integrity checks against the parent rows.
--
-- Non-CONCURRENT on purpose: the deploy-migrations workflow runs `supabase db
-- push` inside a transaction, and CREATE INDEX CONCURRENTLY cannot run in one.
-- These tables are low-write, so the brief build-time lock is acceptable.
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_channel_id ON public.marketing_campaigns (channel_id);
CREATE INDEX IF NOT EXISTS idx_marketing_compliance_log_reviewed_by ON public.marketing_compliance_log (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_marketing_experiments_channel_id ON public.marketing_experiments (channel_id);
CREATE INDEX IF NOT EXISTS idx_marketing_proposals_channel_id ON public.marketing_proposals (channel_id);
CREATE INDEX IF NOT EXISTS idx_marketing_proposals_reviewed_by ON public.marketing_proposals (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_product_lots_coa_retracted_by ON public.product_lots (coa_retracted_by);
CREATE INDEX IF NOT EXISTS idx_product_lots_coa_verified_by ON public.product_lots (coa_verified_by);
CREATE INDEX IF NOT EXISTS idx_product_lots_superseded_by ON public.product_lots (superseded_by);
