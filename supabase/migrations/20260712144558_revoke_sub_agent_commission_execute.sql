-- Security: close an info-disclosure gap missed by security_rpc_lockdown / _2.
-- fn_sub_agent_effective_commission(uuid) is SECURITY DEFINER with NO internal
-- caller guard, so any authenticated user could read ANY sub-agent's effective
-- commission rate by passing an arbitrary p_sub uuid via PostgREST rpc.
-- The app only calls it server-side via the service role
-- (app/api/agent/commission/route.ts -> createServiceClient), which bypasses
-- these grants, so revoking anon/authenticated EXECUTE has zero app impact.
REVOKE EXECUTE ON FUNCTION public.fn_sub_agent_effective_commission(uuid) FROM anon, authenticated;
