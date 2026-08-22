-- Regression fix: marketing_channel_report ran as owner (security_invoker unset)
-- AND was SELECT-able by anon/authenticated, bypassing the RLS on the underlying
-- marketing_* tables. Lock it: run as invoker (respect caller RLS) and revoke
-- API roles. The Command Center artifact queries via the service role, so this
-- does not affect it.
-- NOTE: Applied to production 2026-07-11 via MCP; this file recovered from
-- supabase_migrations.schema_migrations so the repo matches prod history.
alter view public.marketing_channel_report set (security_invoker = on);
revoke all on public.marketing_channel_report from anon, authenticated;
