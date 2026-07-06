DROP FUNCTION IF EXISTS public.redeem_coupon(text, uuid, numeric); DROP FUNCTION IF EXISTS public.redeem_coupon(text, uuid, numeric, uuid);
-- Migration: coupon_per_user_atomic
-- Purpose: Update redeem_coupon RPC to atomically enforce max_uses_per_user.
-- Previously, per-user limit checking was done in application code (lib/coupons.ts)
-- via a non-atomic TOCTOU-vulnerable read-then-check pattern. This migration moves
-- the check into the SECURITY DEFINER function so it runs inside the same atomic
-- UPDATE statement, eliminating the race condition.
--
-- The new p_user_id parameter is DEFAULT NULL for backwards compatibility; callers
-- that do not pass it get the previous behavior (global limit only).

CREATE OR REPLACE FUNCTION public.redeem_coupon(
  p_code TEXT,
  p_agent_id UUID,
  p_order_subtotal NUMERIC,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (coupon_id UUID, discount_type TEXT, discount_value NUMERIC, discount_amount NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_amount NUMERIC := 0;
BEGIN
  UPDATE public.coupons c
  SET uses_count = uses_count + 1
  WHERE c.code = p_code
    AND c.agent_id = p_agent_id
    AND c.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND (c.max_uses IS NULL OR c.uses_count < c.max_uses)
    AND (c.min_order_amount IS NULL OR p_order_subtotal >= c.min_order_amount)
    -- Atomic per-user limit: only enforced when both the column and the caller
    -- supply values (p_user_id IS NOT NULL). Counts non-cancelled orders by this
    -- user that used this coupon code.
    AND (
      c.max_uses_per_user IS NULL
      OR p_user_id IS NULL
      OR (
        SELECT count(*)
        FROM public.orders o
        WHERE o.coupon_code = p_code
          AND o.buyer_id = p_user_id
          AND o.status <> 'cancelled'
      ) < c.max_uses_per_user
    )
  RETURNING c.id, c.discount_type::text, c.discount_value
  INTO v_coupon;

  IF v_coupon.id IS NULL THEN
    RAISE EXCEPTION 'Coupon invalid, expired, or limit reached' USING ERRCODE = 'check_violation';
  END IF;

  IF v_coupon.discount_type = 'percent' THEN
    v_amount := ROUND(p_order_subtotal * v_coupon.discount_value / 100.0, 2);
  ELSE
    v_amount := LEAST(v_coupon.discount_value, p_order_subtotal);
  END IF;

  RETURN QUERY SELECT v_coupon.id, v_coupon.discount_type, v_coupon.discount_value, v_amount;
END;
$$;
