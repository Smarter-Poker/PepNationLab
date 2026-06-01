-- Accurate, uncapped sales summary for one agent's storefront orders.
-- Replaces summing a capped 500-row page in the detail route. SECURITY DEFINER
-- so the route's service client gets a single aggregate round-trip; REVOKEd from
-- anon/authenticated (only reachable via the downline-scoped API route).
--
-- Applied to production via Supabase MCP as agent_sales_summary_rpc.
CREATE OR REPLACE FUNCTION public.agent_sales_summary(p_agent_id uuid)
RETURNS TABLE(
  orders_count bigint,
  noncancelled_count bigint,
  gross_total numeric,
  last30_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    count(*) AS orders_count,
    count(*) FILTER (WHERE status <> 'cancelled') AS noncancelled_count,
    COALESCE(sum(total) FILTER (WHERE status <> 'cancelled'), 0) AS gross_total,
    COALESCE(sum(total) FILTER (WHERE status <> 'cancelled' AND created_at >= now() - interval '30 days'), 0) AS last30_total
  FROM public.orders
  WHERE agent_id = p_agent_id;
$function$;

REVOKE ALL ON FUNCTION public.agent_sales_summary(uuid) FROM anon, authenticated;
