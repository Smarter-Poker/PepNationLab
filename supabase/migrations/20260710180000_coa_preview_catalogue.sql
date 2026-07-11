-- Admin-only catalogue for the COA preview: one row per active product that maps
-- to a compound, carrying the real theoretical mass and sequence. Used to render
-- sample certificates across the whole catalogue. Service-role only.
CREATE OR REPLACE FUNCTION public.coa_preview_catalogue()
RETURNS TABLE (
  id                  uuid,
  name                text,
  slug                text,
  molecular_weight_da numeric,
  sequence_one_letter text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT DISTINCT ON (p.id)
         p.id, p.name, p.slug, c.molecular_weight_da, c.sequence_one_letter
  FROM public.products p
  JOIN public.compounds c ON lower(btrim(c.display_name)) = lower(btrim(p.name))
  WHERE p.is_active = true AND p.is_banned = false
  ORDER BY p.id, c.molecular_weight_da DESC NULLS LAST
$fn$;

REVOKE ALL ON FUNCTION public.coa_preview_catalogue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coa_preview_catalogue() TO service_role;
