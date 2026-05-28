-- =============================================================================
-- Silence advisor warnings: trigger-only SECURITY DEFINER functions should
-- not be callable via PostgREST. Applied via Supabase MCP on 2026-05-28.
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_agent_products_for_new_agent() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_agent_products_for_new_product() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_inventory_on_order_approval() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_stale_pending_orders(INT) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'deduct_prepaid_balance'
      AND pg_get_function_arguments(p.oid) = 'agent_id uuid, amount numeric'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.deduct_prepaid_balance(agent_id uuid, amount numeric) SET search_path = public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.deduct_prepaid_balance(agent_id uuid, amount numeric) FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

ALTER FUNCTION public.seed_agent_products_for_new_agent() SET search_path = public;
