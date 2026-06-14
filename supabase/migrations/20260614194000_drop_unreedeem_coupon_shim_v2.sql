-- 20260614184000_drop_unreedeem_coupon_shim_v2.sql
-- Correctly removes the legacy typoed function (which takes just a single UUID argument)
-- The prior migration attempted to drop it with a (uuid, text) signature, which failed.

DROP FUNCTION IF EXISTS public.unreedeem_coupon(uuid);
