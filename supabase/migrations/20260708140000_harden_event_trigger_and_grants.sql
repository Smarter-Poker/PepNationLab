-- Migration: 20260708140000_harden_event_trigger_and_grants.sql
-- Description: Hardens the event trigger to log errors instead of silently failing,
--              and retroactively fixes a legacy grant on charge_order_credit_line.

-- 1. Redefine the event trigger function with error logging instead of silent swallowing.
CREATE OR REPLACE FUNCTION public._autolock_privileged_functions()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  obj record;
  sensitive text[] := ARRAY[
    'wallet_transfer','deduct_prepaid_balance','refund_prepaid_balance','credit_prepaid_balance',
    'charge_order_credit_line','charge_credit_line','reverse_order_credit_charge','super_credit_agent_balance',
    'admin_credit_account','issue_store_credit','issue_refund','redeem_store_credit','release_store_credit',
    'cancel_order','settle_sub_agent_week','pay_weekly_statement','redeem_coupon','unredeem_coupon',
    'reserve_inventory','release_inventory','fn_admin_search_orders','fn_provisioned_accounts',
    'shippo_record_refund','shippo_enqueue_label_job','decide_credit_increase','consume_slug_reservation',
    'cancel_stale_pending_orders','coupons_daily_expiry_sweep','apply_due_price_changes',
    'upsert_agent_invoice_atomic','accrue_sub_agent_commission','fulfil_researcher_referral',
    'resolve_statement_dispute','refresh_recommendation_views','refresh_compound_search'
  ];
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE object_type = 'function' LOOP
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.oid = obj.objid AND n.nspname = 'public' AND p.proname = ANY(sensitive)
      ) THEN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', obj.object_identity);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', obj.object_identity);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.audit_log (event_type, event_data, created_at)
      VALUES ('autolock_failure', jsonb_build_object('fn', obj.object_identity, 'err', SQLERRM), now());
    END;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.audit_log (event_type, event_data, created_at)
  VALUES ('autolock_global_failure', jsonb_build_object('err', SQLERRM), now());
END $$;

-- 2. Retroactively fix phase2 grant for charge_order_credit_line
DO $$ 
DECLARE
  rec record;
BEGIN
  FOR rec IN 
    SELECT p.oid::regprocedure AS sig 
    FROM pg_proc p 
    WHERE p.pronamespace='public'::regnamespace AND p.proname='charge_order_credit_line'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', rec.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', rec.sig);
  END LOOP;
END $$;
