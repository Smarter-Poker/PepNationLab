-- ============================================================================
-- Audit Hardening (2026-07-06): Align The Pricing Sync Trigger Functions With
-- The Platform search_path Convention (public, pg_temp) Established By
-- 20260706140000_pin_search_path_trigger_functions.sql. They Were Pinned To
-- Only "public", Which Is Safe But Inconsistent With The Convention.
-- Applied To ydsaqnnuwyvtyxgvrnys Via Supabase MCP.
-- ============================================================================

ALTER FUNCTION public.fn_sync_house_tiers_from_pricing_tiers() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_sync_tier_lock_on_tier_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_sync_retail_price_on_house_tier_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_sync_retail_price_on_product_change() SET search_path = public, pg_temp;
