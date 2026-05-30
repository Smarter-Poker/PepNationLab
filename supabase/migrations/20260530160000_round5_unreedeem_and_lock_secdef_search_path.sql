-- ============================================================
-- Round 5 deep sweep fixes
-- Applied to ydsaqnnuwyvtyxgvrnys via Supabase MCP on 2026-05-30.
-- Mirrored here for replay / fresh-clone safety.
-- ============================================================

-- 1. unreedeem_coupon — app/api/orders/route.ts calls this RPC 7 times
--    on every coupon rollback path but it was never deployed. Every coupon
--    rollback was silently failing (rpc returned error and we swallowed it),
--    and the redeemed coupon stayed permanently incremented.
CREATE OR REPLACE FUNCTION public.unreedeem_coupon(p_coupon_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.coupons
  SET uses_count = GREATEST(0, uses_count - 1)
  WHERE id = p_coupon_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.unreedeem_coupon(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unreedeem_coupon(UUID) TO authenticated, service_role;

-- 2. Lock SET search_path on 10 SECURITY DEFINER functions that were
--    flagged by Supabase advisor.
ALTER FUNCTION public._trg_recalc_on_agent_tier()              SET search_path = public, pg_temp;
ALTER FUNCTION public._trg_recalc_on_margin()                  SET search_path = public, pg_temp;
ALTER FUNCTION public._trg_recalc_on_override()                SET search_path = public, pg_temp;
ALTER FUNCTION public._trg_recalc_on_product_base_cost()       SET search_path = public, pg_temp;
ALTER FUNCTION public._trg_recalc_on_tier_multiplier()         SET search_path = public, pg_temp;
ALTER FUNCTION public.apply_due_price_changes()                SET search_path = public, pg_temp;
ALTER FUNCTION public.deduct_inventory_on_order_approval()     SET search_path = public, pg_temp;
ALTER FUNCTION public.recalculate_agent_product_prices(uuid, uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.seed_agent_products_for_new_agent()      SET search_path = public, pg_temp;
ALTER FUNCTION public.seed_agent_products_for_new_product()    SET search_path = public, pg_temp;
