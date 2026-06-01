-- Phase B of follow-up batch: replace the blanket public-read policy on
-- agent_inventory with a SECDEF RPC scoped to a single storefront slug.
-- Anon visitors of /{slug} need stock badges; they should NOT be able to
-- enumerate every agent's inventory across the network.

CREATE OR REPLACE FUNCTION public.agent_inventory_for_storefront(p_slug TEXT)
RETURNS TABLE (product_id UUID, stock_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_agent_id UUID;
BEGIN
  -- Match the storefront slug (case-insensitive via the lower(slug) unique
  -- index) and only resolve it if the agent_profile is active AND the
  -- underlying agent profile is active. A paused / banned agent's inventory
  -- never leaks.
  SELECT ap.id
    INTO v_agent_id
    FROM public.agent_profiles ap
    JOIN public.profiles p ON p.id = ap.id
   WHERE lower(ap.slug) = lower(p_slug)
     AND ap.is_active = true
     AND p.is_active = true
   LIMIT 1;

  IF v_agent_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT i.product_id, COALESCE(i.stock_count, 0)::INTEGER
      FROM public.agent_inventory i
     WHERE i.agent_id = v_agent_id;
END;
$$;

COMMENT ON FUNCTION public.agent_inventory_for_storefront(TEXT) IS
  'SECDEF: returns (product_id, stock_count) for the active storefront matching p_slug. Used by the storefront SSR to render stock badges without granting public-read on the whole agent_inventory table.';

GRANT EXECUTE ON FUNCTION public.agent_inventory_for_storefront(TEXT) TO anon, authenticated;

-- Drop the blanket public-read policy. Anon visitors now get inventory data
-- via the RPC above, scoped to a single agent. The other policies (admin
-- manage, agents view/insert/update their own, sub-agent parent visibility,
-- researchers can read their tagged agent's inventory) stay in place.
DROP POLICY IF EXISTS "Public can read agent inventory" ON public.agent_inventory;
