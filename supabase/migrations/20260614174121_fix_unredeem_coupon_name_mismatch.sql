-- Bug fix (2026-06-14): application code calls rpc('unredeem_coupon', ...) (4 sites
-- in app/api/orders/route.ts) but the live DB only had the misspelled
-- public.unreedeem_coupon(uuid). The mismatched call silently fails, so a coupon's
-- uses_count is never restored when an order is cancelled/fails -> coupons get
-- permanently consumed by failed orders.
--
-- Additive, deploy-timing-proof fix: create the correctly-spelled function with the
-- IDENTICAL body so the new code works, while leaving unreedeem_coupon in place so
-- any not-yet-deployed code that still calls the old name keeps working. Once the
-- code rename is fully deployed everywhere, unreedeem_coupon can be dropped.
CREATE OR REPLACE FUNCTION public.unredeem_coupon(p_coupon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.coupons
  SET uses_count = GREATEST(0, uses_count - 1)
  WHERE id = p_coupon_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.unredeem_coupon(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unredeem_coupon(uuid) TO service_role;
