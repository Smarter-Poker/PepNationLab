-- Migration: Trigger helper RPCs for the COA rotation cron job.
-- The cron service role calls exec_disable_coa_triggers before INSERT
-- and exec_enable_coa_triggers immediately after, so the freeze guard
-- never blocks new lot creation or the superseded_by update.
-- Generated 2026-07-11

CREATE OR REPLACE FUNCTION public.exec_disable_coa_triggers()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  ALTER TABLE public.product_lots DISABLE TRIGGER trg_coa_freeze_verified;
  ALTER TABLE public.product_lots DISABLE TRIGGER trg_coa_block_verified_delete;
END;
$$;

CREATE OR REPLACE FUNCTION public.exec_enable_coa_triggers()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  ALTER TABLE public.product_lots ENABLE TRIGGER trg_coa_freeze_verified;
  ALTER TABLE public.product_lots ENABLE TRIGGER trg_coa_block_verified_delete;
END;
$$;

-- Only the service role can call these
REVOKE ALL ON FUNCTION public.exec_disable_coa_triggers() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.exec_enable_coa_triggers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exec_disable_coa_triggers() TO service_role;
GRANT EXECUTE ON FUNCTION public.exec_enable_coa_triggers() TO service_role;
