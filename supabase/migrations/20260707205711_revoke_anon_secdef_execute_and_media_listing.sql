-- Security hardening pass 2 (2026-07-07)
--
-- 1) SECURITY DEFINER functions: revoke anonymous EXECUTE.
--    The Supabase linter flagged 70 SECURITY DEFINER functions executable by
--    anon (wallet_transfer, deduct_prepaid_balance, cancel_order, ...).
--    Verified against the codebase: every rpc() call site runs on either the
--    service-role client or an authenticated user-token client, with ONE
--    exception (agent_inventory_for_storefront, called while anonymous
--    visitors browse public storefronts).
--
--    For every SECURITY DEFINER function in public:
--      - REVOKE EXECUTE FROM PUBLIC, anon   (closes the anonymous surface)
--      - GRANT  EXECUTE TO authenticated, service_role  (behavior preserved)
--    Then re-grant anon ONLY to:
--      - functions referenced inside RLS policy expressions (is_admin(),
--        fn_messenger_is_participant(), ... must be evaluable when anonymous
--        visitors query policy-guarded tables, or every guest read breaks)
--      - agent_inventory_for_storefront (guest storefront browsing)
--
--    Authenticated EXECUTE is intentionally left in place: many functions are
--    legitimately called with user tokens (pay_invoice, freeze_account,
--    log_account_event, ...). Tightening that layer requires a per-function
--    product review and is tracked separately.
--
-- 2) storage: messenger_media listing.
--    The bucket is public, so downloads use direct public URLs and bypass
--    RLS entirely; the public SELECT policy only enabled anonymous LISTING /
--    enumeration of every message attachment path via the storage API.
--    Restrict listing to authenticated users. (avatars / product-images /
--    product-coas remain public by design.)

-- ── 1. Revoke anon EXECUTE on SECURITY DEFINER functions ───────────────────
DO $$
DECLARE
  fn record;
  policy_fns text[];
BEGIN
  -- Function names referenced anywhere in RLS policy expressions (public +
  -- storage schemas): these must remain executable by anon so that policy
  -- evaluation works for anonymous queries.
  SELECT COALESCE(array_agg(DISTINCT m.match[1]), '{}') INTO policy_fns
  FROM pg_policies pol,
       LATERAL regexp_matches(
         COALESCE(pol.qual, '') || ' ' || COALESCE(pol.with_check, ''),
         '([a-z_][a-z0-9_]*)\s*\(', 'g'
       ) AS m(match);

  FOR fn IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn.sig);
    IF fn.proname = ANY (policy_fns) OR fn.proname = 'agent_inventory_for_storefront' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', fn.sig);
    END IF;
  END LOOP;
END $$;

-- ── 2. messenger_media: stop anonymous enumeration ─────────────────────────
DROP POLICY IF EXISTS "messenger_media_public_read" ON storage.objects;

CREATE POLICY "messenger_media_authenticated_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'messenger_media');
