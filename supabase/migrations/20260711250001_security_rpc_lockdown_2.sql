-- Security RPC Lockdown, Pass 2 (2026-07-11 audit follow-up).
--
-- The Supabase security advisor flagged 94 SECURITY DEFINER functions as
-- executable by the authenticated role (17 also by anon) over the PostgREST
-- /rest/v1/rpc endpoint. Pass 1 (20260711160000) only covered three functions.
-- This pass closes the remaining privilege-escalation surface, verified as
-- follows before writing:
--
--   1. App call sites: every function revoked here is either never called from
--      app code at all, or called ONLY through the service-role / admin client
--      (createAdminClient / createServiceClient), which is unaffected by these
--      revokes. Functions invoked with the user-session client (agent_sales_kpis,
--      pay_invoice, freeze_account, get_statement_detail, forecast_next_statement,
--      etc.) are NOT revoked -- they carry internal auth.uid()/is_admin() guards.
--   2. RLS policies: none of the functions below are referenced by any
--      pg_policies qual or with_check (verified 2026-07-11), so revoking cannot
--      break row-level security evaluation.
--   3. Trigger functions fire regardless of the caller's EXECUTE privilege
--      (checked only at CREATE TRIGGER time), so revoking direct RPC access
--      is pure attack-surface reduction.
--
-- service_role and the postgres owner retain EXECUTE in every case.
-- REVOKE of an absent grant is a no-op, so this migration is idempotent.

-- ============================================================
-- 1. Money-touching functions with NO internal caller guard.
--    Any authenticated researcher could previously call these directly:
--    drain any agent's prepaid balance, approve their own order, trigger the
--    statement auto-pay sweep, or mint referral rewards.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.deduct_prepaid_balance(uuid, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_agent_order_atomic(uuid, uuid, numeric, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_pay_due_statements() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fulfil_referral_reward(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_referral_code(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.void_sub_agent_commission(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pay_invoice(text, uuid, text, numeric, uuid) FROM PUBLIC, anon;

-- ============================================================
-- 2. Admin/service-only helpers (app calls them exclusively through the
--    service-role client; no session-client call path exists).
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.recalculate_agent_product_prices(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.provision_agent_storefront(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.walk_billing_chain(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_credit_chain(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_admin_downline_tree(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_admin_operational_nudges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agent_sales_summary(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prune_old_notifications() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_recommendation_views_plain() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 3. Trigger functions. They fire from their triggers regardless of role
--    EXECUTE grants; direct RPC executability is pure attack surface.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.stamp_attribution_on_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_user_sign_in() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_inventory_on_order_approval() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_subagent_under_superagent() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_no_nested_sub_agents() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_referring_sub_agent_is_sub_agent() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_audit_agent_product_price() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_auto_admin_conversation_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_emancipate_sub_agents_on_ban() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_mm_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_mm_cleanup_pins_on_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_mpins_enforce_cap() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_recalc_agent_products_on_markup_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_sync_house_tiers_from_pricing_tiers() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_sync_retail_price_on_house_tier_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_sync_retail_price_on_product_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_sync_tier_lock_on_tier_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_terminate_calls_on_block() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_messenger_messages_support_sla() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_messenger_support_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_profiles_provision_storefront() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_void_subagent_commission_on_cancel() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trim_recently_viewed() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 4. get_or_create_referral_code stays session-callable (the referrals page
--    calls it with the user's own id) but previously accepted ANY p_user_id,
--    letting one user mint or read another user's referral code. Add a
--    self-or-admin guard; the service role (auth.uid() IS NULL) is unaffected.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_code TEXT;
  v_attempt INTEGER := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT referral_code INTO v_code FROM public.profiles WHERE id = p_user_id;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;

  LOOP
    v_attempt := v_attempt + 1;
    -- base32-ish 6-char code from random bytes
    v_code := upper(substring(encode(gen_random_bytes(8), 'base32') from 1 for 6));
    -- strip any ambiguous chars and ensure 6 length
    v_code := translate(v_code, '01', 'AB');
    BEGIN
      UPDATE public.profiles SET referral_code = v_code WHERE id = p_user_id AND referral_code IS NULL;
      IF FOUND THEN RETURN v_code; END IF;
      -- another writer beat us; refetch
      SELECT referral_code INTO v_code FROM public.profiles WHERE id = p_user_id;
      IF v_code IS NOT NULL THEN RETURN v_code; END IF;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt > 10 THEN RAISE EXCEPTION 'Could not allocate referral code'; END IF;
    END;
  END LOOP;
END;
$function$;
