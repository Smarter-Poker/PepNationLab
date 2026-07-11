-- Admin management catalogue: one row per active product that maps to a compound,
-- with real chemistry and its current COA status. Drives the /admin/coa list.
CREATE OR REPLACE FUNCTION public.coa_admin_catalogue()
RETURNS TABLE (
  id                  uuid,
  name                text,
  slug                text,
  molecular_weight_da numeric,
  sequence_one_letter text,
  published_count     bigint,
  draft_count         bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  WITH base AS (
    SELECT DISTINCT ON (p.id)
           p.id, p.name, p.slug, c.molecular_weight_da, c.sequence_one_letter
    FROM public.products p
    JOIN public.compounds c ON lower(btrim(c.display_name)) = lower(btrim(p.name))
    WHERE p.is_active = true AND p.is_banned = false
    ORDER BY p.id, c.molecular_weight_da DESC NULLS LAST
  )
  SELECT b.id, b.name, b.slug, b.molecular_weight_da, b.sequence_one_letter,
         count(l.id) FILTER (
           WHERE l.coa_verified_at IS NOT NULL AND l.coa_retracted_at IS NULL AND l.superseded_by IS NULL
         ),
         count(l.id) FILTER (
           WHERE l.coa_verified_at IS NULL AND l.superseded_by IS NULL
         )
  FROM base b
  LEFT JOIN public.product_lots l ON l.product_id = b.id
  GROUP BY b.id, b.name, b.slug, b.molecular_weight_da, b.sequence_one_letter
  ORDER BY b.name;
$fn$;

REVOKE ALL ON FUNCTION public.coa_admin_catalogue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coa_admin_catalogue() TO service_role;
