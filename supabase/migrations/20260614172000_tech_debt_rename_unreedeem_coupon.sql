-- ============================================================================
-- Tech-debt: rename unreedeem_coupon → unredeem_coupon (2026-06-14)
-- ============================================================================
-- The function name has a double-e typo ("unreedeem"). App code matches the
-- typo at 4 call sites in app/api/orders/route.ts, so it works. This
-- migration adds the correctly-spelled alias and retains the old name as a
-- temporary compatibility shim so that a phased rollout is safe (old code
-- still calls the typo name; new code calls the corrected name).
--
-- After the app is deployed with the updated callers (orders/route.ts), a
-- follow-up migration can DROP the shim.
--
-- App callers updated in this commit:
--   app/api/orders/route.ts:635, 893, 906, 945 → rpc('unredeem_coupon', ...)
-- ============================================================================

-- Create the correctly-spelled function (replace if already exists from a
-- prior manual run).
CREATE OR REPLACE FUNCTION public.unredeem_coupon(p_coupon_id UUID)
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

REVOKE EXECUTE ON FUNCTION public.unredeem_coupon(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.unredeem_coupon(UUID) TO authenticated, service_role;

-- Keep the old typo'd name as a shim that delegates to the new one.
-- This lets the old app binary keep working during the deployment window.
CREATE OR REPLACE FUNCTION public.unreedeem_coupon(p_coupon_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.unredeem_coupon(p_coupon_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.unreedeem_coupon(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.unreedeem_coupon(UUID) TO authenticated, service_role;
