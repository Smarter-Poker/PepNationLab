-- Fixes for RLS bypasses via SECURITY DEFINER functions missing execution revokes.
-- Replaces default PUBLIC execution with explicit role grants or internal auth checks.

-- 1. Arbitrary Order Approval
REVOKE EXECUTE ON FUNCTION public.approve_agent_order_atomic(uuid, uuid, numeric, text, text, timestamptz) FROM PUBLIC, authenticated, anon;

-- 2. Invoice Forgery
REVOKE EXECUTE ON FUNCTION public.upsert_agent_invoice_atomic(uuid, uuid, date, date, numeric, numeric, numeric) FROM PUBLIC, authenticated, anon;

-- 3. Referral Reward Exploitation
REVOKE EXECUTE ON FUNCTION public.fulfil_researcher_referral(uuid) FROM PUBLIC, authenticated, anon;

-- 4. Mass Price Recalculation (Potential DoS)
REVOKE EXECUTE ON FUNCTION public.recalculate_agent_product_prices(uuid, uuid, text) FROM PUBLIC, authenticated, anon;

-- 5. Coupon Denial of Service
REVOKE EXECUTE ON FUNCTION public.redeem_coupon(TEXT, UUID, NUMERIC, UUID) FROM PUBLIC, authenticated, anon;

-- 6. Data Leak: Wholesale Volume
REVOKE EXECUTE ON FUNCTION public.fn_agent_own_wholesale_30d_batch(uuid[]) FROM PUBLIC, authenticated, anon;

-- 7. Unauthorized Credit Line Exhaustion
REVOKE EXECUTE ON FUNCTION public.charge_order_credit_line(uuid, uuid) FROM authenticated;

-- 8. Fix missing TG_OP logic in fn_audit_agent_product_price
CREATE OR REPLACE FUNCTION public.fn_audit_agent_product_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.price_audit_logs (
      agent_id, product_id, old_retail_price, new_retail_price, old_margin_percent, new_margin_percent, reason
    ) VALUES (
      NEW.agent_id, NEW.product_id, NULL, NEW.retail_price, NULL, NEW.margin_percent, 'Initial Creation'
    );
    RETURN NEW;
  END IF;

  -- If nothing changed, skip
  IF (OLD.retail_price = NEW.retail_price AND OLD.margin_percent = NEW.margin_percent) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.price_audit_logs (
    agent_id, product_id, old_retail_price, new_retail_price, old_margin_percent, new_margin_percent, reason
  ) VALUES (
    NEW.agent_id, NEW.product_id, OLD.retail_price, NEW.retail_price, OLD.margin_percent, NEW.margin_percent, 'System Update'
  );

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_agent_order_atomic(uuid, uuid, numeric, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_agent_invoice_atomic(uuid, uuid, date, date, numeric, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.fulfil_researcher_referral(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_agent_product_prices(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(TEXT, UUID, NUMERIC, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_agent_own_wholesale_30d_batch(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.charge_order_credit_line(uuid, uuid) TO service_role;
