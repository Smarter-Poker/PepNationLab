-- ============================================================================
-- RLS isolation regression check  (read-only; safe to run against production)
-- ============================================================================
-- Purpose: prove that Row Level Security still isolates user data after schema
-- or policy changes. It exercises RLS the way Supabase does at runtime -- by
-- switching to the `anon` / `authenticated` role and setting the JWT claim --
-- rather than relying on the migration role (which bypasses RLS).
--
-- It performs NO writes. The role is reset after every check. Run it in the
-- Supabase SQL editor, in psql, or wire the DO block into CI.
--
-- Last verified PASS: 2026-06-14 against project ydsaqnnuwyvtyxgvrnys.
--   - anon sees 0 rows in every sensitive table that has data
--   - a non-owner authenticated user sees 0 of: notifications (72),
--     balance_transactions (5), messenger_messages (4), saved_addresses (1)
--   - the owning admin still sees their oversight rows (policies grant, not just deny)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART 1 -- Runnable invariant: `anon` must never read a user-owned row.
-- RAISEs EXCEPTION (fails the run) on any leak; NOTICE "PASS" otherwise.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_tables text[] := ARRAY[
    'balance_transactions','notifications','saved_addresses','messenger_messages',
    'payment_proofs','researcher_notes','user_saved_compounds','orders','order_items',
    'researcher_biometrics','researcher_doses','profiles','agent_inventory','weekly_statements',
    'store_credits','sub_agent_commission_ledger','disclaimer_acceptances','push_subscriptions'
  ];
  v_tbl text; v_total bigint; v_anon bigint; v_leaks int := 0; v_checked int := 0;
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    -- Skip tables that do not exist or have no rows to leak.
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', v_tbl) INTO v_total;
    EXCEPTION WHEN undefined_table THEN CONTINUE;
    END;
    CONTINUE WHEN v_total = 0;
    v_checked := v_checked + 1;

    BEGIN
      SET LOCAL ROLE anon;
      PERFORM set_config('request.jwt.claims', '', true);
      EXECUTE format('SELECT count(*) FROM public.%I', v_tbl) INTO v_anon;
      RESET ROLE;
    EXCEPTION WHEN insufficient_privilege THEN
      RESET ROLE; v_anon := 0;  -- anon has no grant at all = isolated
    END;

    IF v_anon <> 0 THEN
      v_leaks := v_leaks + 1;
      RAISE WARNING 'RLS LEAK: anon can read % of % rows in public.%', v_anon, v_total, v_tbl;
    END IF;
  END LOOP;

  IF v_leaks > 0 THEN
    RAISE EXCEPTION 'RLS ISOLATION: FAIL (% leaking table(s) of % with data)', v_leaks, v_checked;
  END IF;
  RAISE NOTICE 'RLS ISOLATION: PASS (% sensitive tables with data; anon sees 0 rows in each)', v_checked;
END $$;

-- ----------------------------------------------------------------------------
-- PART 2 -- Manual deep check: impersonate a specific authenticated user and
-- confirm they only see their OWN rows. Replace the two UUIDs and run.
-- This is the exact technique used to verify isolation on 2026-06-14.
-- ----------------------------------------------------------------------------
-- SET ROLE authenticated;
-- SELECT set_config('request.jwt.claims',
--   '{"sub":"<NON_OWNER_USER_UUID>","role":"authenticated"}', false);
-- SELECT set_config('app.seen', (SELECT count(*) FROM public.balance_transactions)::text, false);
-- RESET ROLE;
-- SELECT set_config('request.jwt.claims','', false);
-- SELECT current_setting('app.seen') AS rows_visible_to_non_owner;  -- expect 0
