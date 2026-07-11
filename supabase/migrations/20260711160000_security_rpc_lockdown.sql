-- Security: remove unauthenticated (anon) / PUBLIC EXECUTE on privileged helper
-- functions that have no reason to be callable over the PostgREST RPC endpoint.
--
-- Scope chosen from a live audit of pg_policies (2026-07-11). Functions that are
-- REFERENCED BY RLS POLICIES are deliberately left untouched: a role running a
-- query against an RLS-protected table must retain EXECUTE on any function the
-- policy calls, so revoking it would break row-level security. Left as-is:
--   is_admin (113 policy refs), get_user_role, is_agent_or_above, is_super_agent,
--   fn_is_platform_admin, fn_messenger_is_participant,
--   fn_messenger_is_admin_or_owner, get_sub_agent_ids.
-- The two intentionally-public storefront/COA helpers are also left public:
--   agent_inventory_for_storefront(text), lookup_coa_by_lot(text).
--
-- Only functions with ZERO policy references and no guest/public call path are
-- locked down here. ACLs were confirmed via pg_proc.proacl before writing:
--   _autolock_privileged_functions() and enforce_reserved_username() carry a
--   PUBLIC grant (=X) plus explicit anon/authenticated grants; coa_coverage_gaps
--   has an explicit anon grant only (no PUBLIC grant).
-- service_role and the postgres owner retain EXECUTE in every case.
--
-- REVOKE is idempotent (revoking an absent grant is a no-op), so this migration
-- is safe to run repeatedly.

-- Internal auto-lock utility. Never meant to be invoked directly over RPC.
REVOKE EXECUTE ON FUNCTION public._autolock_privileged_functions() FROM PUBLIC, anon, authenticated;

-- Trigger function. It fires from its trigger regardless of role EXECUTE grants,
-- so direct RPC executability is pure attack surface.
REVOKE EXECUTE ON FUNCTION public.enforce_reserved_username() FROM PUBLIC, anon, authenticated;

-- Admin/reporting function (COA coverage gaps). No anonymous call path; drop only
-- the anon grant. authenticated + service_role keep their explicit grants.
REVOKE EXECUTE ON FUNCTION public.coa_coverage_gaps(integer) FROM anon;
