-- Security: revoke anon/authenticated API access to materialized views that are
-- read exclusively server-side via the service-role client.
-- Applied to prod (ydsaqnnuwyvtyxgvrnys) via Supabase MCP as ledger version 20260707214940.
--
-- Verified read sites all use createServiceClient():
--   product_popular_60d   -> app/lab-journal/page.tsx, app/api/storefront/recommendations,
--                            app/api/cart/recommendations, app/orders/[id]/page.tsx
--   product_copurchase_pairs -> recommendations (service) + cron refresh
--   compound_search       -> app/api/research/search, app/api/research/suggest (service)
--
-- Closes the "Materialized View in API" security-advisor findings (anonymous PostgREST
-- enumeration of aggregate product/search data). No app impact; service role keeps access.
REVOKE SELECT ON public.product_popular_60d      FROM anon, authenticated;
REVOKE SELECT ON public.product_copurchase_pairs FROM anon, authenticated;
REVOKE SELECT ON public.compound_search          FROM anon, authenticated;
