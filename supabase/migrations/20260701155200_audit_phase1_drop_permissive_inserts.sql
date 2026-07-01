-- ============================================================================
-- Phase 1 Hardening: Drop Permissive Insert Policies
-- ============================================================================
-- The following tables have API routes that use the `service_role` key to bypass
-- RLS (e.g. createServiceClient()), but their SQL schema accidentally left the
-- RLS INSERT policy open to `public` or `anon`. This allows an attacker to bypass
-- the application-level API rate limiters and insert spam directly via PostgREST.
-- We drop these permissive policies to instantly secure the database.

-- 1. shared_research_protocols (app/api/research/share/route.ts uses service_role)
DROP POLICY IF EXISTS "Anyone can insert shared protocols" ON public.shared_research_protocols;

-- 2. agent_storefront_events (app/api/storefront/events/route.ts uses service_role)
DROP POLICY IF EXISTS storefront_events_anon_insert ON public.agent_storefront_events;

-- 3. missed_searches (app/api/analytics/missed-search/route.ts uses service_role)
DROP POLICY IF EXISTS "Allow insert from anyone" ON public.missed_searches;

-- 4. api_request_log (lib/research/api-keys.ts uses service_role)
DROP POLICY IF EXISTS apilog_service_write ON public.api_request_log;

-- Note: No replacement policies are needed because the service_role bypasses RLS.
