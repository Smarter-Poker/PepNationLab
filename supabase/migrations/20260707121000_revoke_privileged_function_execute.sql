-- Security hardening (2026-07-07 audit): Supabase advisors flagged 70
-- SECURITY DEFINER functions executable by anon and 97 by authenticated.
-- Function bodies do their own auth checks today, but grants — not bodies —
-- should be the safety boundary: one missed auth.uid() check inside any of
-- these becomes an unauthenticated money/state exploit.
--
-- Caller audit (verified in app code 2026-07-07):
--   * Every function in SERVICE_ONLY below is invoked exclusively through
--     createAdminClient()/createServiceClient() (service_role) route handlers
--     or CRON_SECRET-gated cron routes. No browser client calls any RPC.
--   * Functions in AUTH_REQUIRED are called through the user-authed server
--     client and need auth.uid() (e.g. get_statement_detail per R24 hotfix),
--     so they keep authenticated EXECUTE and lose only PUBLIC/anon.
--
-- The DO block resolves every overload via pg_proc and skips names that do
-- not exist, so this migration is safe on fresh rebuilds at any point in the
-- migration timeline.

DO $$
DECLARE
  fn text;
  rec record;
  service_only text[] := ARRAY[
    'wallet_transfer',
    'deduct_prepaid_balance',
    'refund_prepaid_balance',
    'credit_prepaid_balance',
    'charge_order_credit_line',
    'reverse_order_credit_charge',
    'super_credit_agent_balance',
    'admin_credit_account',
    'issue_store_credit',
    'redeem_store_credit',
    'release_store_credit',
    'cancel_order',
    'settle_sub_agent_week',
    'pay_weekly_statement',
    'redeem_coupon',
    'unredeem_coupon',
    'reserve_inventory',
    'release_inventory',
    'fn_admin_search_orders',
    'fn_provisioned_accounts',
    'shippo_record_refund',
    'shippo_enqueue_label_job',
    'decide_credit_increase',
    'consume_slug_reservation',
    'cancel_stale_pending_orders',
    'coupons_daily_expiry_sweep',
    'apply_due_price_changes',
    'upsert_agent_invoice_atomic',
    'accrue_sub_agent_commission',
    'fulfil_researcher_referral',
    'resolve_statement_dispute',
    'refresh_recommendation_views',
    'refresh_compound_search'
  ];
  auth_required text[] := ARRAY[
    'freeze_account',
    'unfreeze_account',
    'pay_invoice',
    'get_statement_detail',
    'mark_message_read'
  ];
BEGIN
  FOREACH fn IN ARRAY service_only LOOP
    FOR rec IN
      SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace AND p.proname = fn
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', rec.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', rec.sig);
    END LOOP;
  END LOOP;

  FOREACH fn IN ARRAY auth_required LOOP
    FOR rec IN
      SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace AND p.proname = fn
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', rec.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', rec.sig);
    END LOOP;
  END LOOP;
END $$;

-- Advisors also flagged 19 functions with a mutable search_path (schema
-- shadowing risk for SECURITY DEFINER bodies). Pin them, same pattern as
-- 20260706140000_pin_search_path_trigger_functions.sql.
DO $$
DECLARE
  fn text;
  rec record;
  to_pin text[] := ARRAY[
    'payment_proof_order_id',
    'refresh_compound_quality_score',
    'compute_compound_quality_score',
    'guarded_function_lock_key',
    'lock_guarded_function',
    'record_function_rewrite',
    'tg_admin_shadow_notes_touch_updated',
    'tg_cart_recovery_variants_touch',
    'slugify_for_storefront',
    'trg_agent_profiles_stamp_renamed',
    'fn_house_default_commission_steps',
    'compounds_set_updated_at',
    'enforce_name_capitalization_trigger',
    'enforce_profile_name_capitalization_trigger',
    'update_researcher_notes_updated_at',
    'match_products_vector',
    'capitalize_words_preserve_case',
    'touch_course_progress',
    'compound_references_default_ref_type'
  ];
BEGIN
  FOREACH fn IN ARRAY to_pin LOOP
    FOR rec IN
      SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace AND p.proname = fn
    LOOP
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_catalog', rec.sig);
    END LOOP;
  END LOOP;
END $$;
