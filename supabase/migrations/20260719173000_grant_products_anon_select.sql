-- Storefront catalog is publicly viewable (RLS policy "Anyone can view active
-- products" targets PUBLIC), but the anon role was missing the table-level
-- SELECT grant -- so logged-out visitors intermittently hit
-- "permission denied for table products" on /[agentSlug] storefront pages
-- (observed in production runtime logs, 8 distinct users since 2026-07-11).
-- RLS still applies on top of this grant; anon only ever sees active products.
-- Applied to production 2026-07-19.
GRANT SELECT ON public.products TO anon;
