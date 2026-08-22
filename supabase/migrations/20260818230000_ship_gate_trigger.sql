-- =============================================================================
-- SHIP GATE, ENFORCED AT THE DATABASE (2026-08-18)
--
-- The rule "a ship order whose buyer pays per order cannot be approved to
-- ship until the agent confirms payment receipt" lived only in the agent
-- approve route. Every other path that can move an order into approved_ship
-- (the admin release route via admin_force_update_order, bulk admin updates,
-- future routes, direct SQL from other agents' sessions) skipped it. This
-- trigger makes the rule hold no matter who performs the transition.
--
-- Scope, deliberately narrow:
--   - UPDATE only. Checkout inserts trusted auto-approved orders directly at
--     approved_ship (credit buyers / auto_approve_orders accounts); inserts
--     keep working exactly as before.
--   - Only the transition INTO approved_ship from a pre-approval status.
--     shipped / delivered updates record physical facts (often from carrier
--     webhooks) and must never be blocked after the package is gone.
--   - Only orders with a buyer who pays per order (anything except a
--     credit-line account, which settles via weekly statements).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_payment_confirmation_before_ship()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_buyer_type text;
BEGIN
  -- Gate every jump from a pre-approval status into the ship pipeline, not
  -- just approved_ship: the admin transition matrix allows
  -- pending -> in_fulfillment directly, which would otherwise launder an
  -- unconfirmed order around the gate. Webhook-driven updates
  -- (in_fulfillment -> shipped, shipped -> delivered) start from a
  -- post-approval status and are never touched.
  IF NEW.status IN ('approved_ship', 'in_fulfillment', 'shipped')
     AND OLD.status IN ('pending_customer_payment', 'agent_approval_pending', 'admin_approval_pending')
     AND NEW.payment_confirmed_at IS NULL
     AND NEW.buyer_id IS NOT NULL
     AND NEW.fulfillment_method = 'ship' THEN
    SELECT account_type INTO v_buyer_type FROM public.profiles WHERE id = NEW.buyer_id;
    IF v_buyer_type IS DISTINCT FROM 'credit' THEN
      RAISE EXCEPTION 'payment_confirmation_required: Confirm The Buyer''s Payment (Did You Receive Payment?) Before Approving This Ship Order.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_payment_confirmation_before_ship ON public.orders;
CREATE TRIGGER trg_enforce_payment_confirmation_before_ship
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_payment_confirmation_before_ship();
