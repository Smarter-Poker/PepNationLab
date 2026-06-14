-- 20260614182216_drop_unreedeem_coupon_shim.sql
-- Removes the legacy typoed function after all frontend code was migrated to the correct unredeem_coupon name.

DROP FUNCTION IF EXISTS public.unreedeem_coupon(uuid, text);
