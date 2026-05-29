-- ─── Recommendations Engine ─────────────────────────────────────────────────
-- Two materialized views feed the "You May Also Like" / "Researchers Also
-- Bought" UI surface:
--   1. product_copurchase_pairs — symmetric co-purchase frequency matrix.
--      For every pair of products that have ever appeared together in a
--      completed, non-restock order, store (product_a, product_b, pair_count)
--      where product_a < product_b. Symmetric lookups happen via the wrapper
--      RPC get_copurchase_recommendations.
--   2. product_popular_60d — fallback "trending" list of top products by
--      units sold in the last 60 days.
--
-- Both views are refreshed by a daily cron at /api/cron/recommendations-refresh
-- via the refresh_recommendation_views() wrapper, which uses CONCURRENTLY
-- so the views stay readable during the refresh.
-- ────────────────────────────────────────────────────────────────────────────

-- Co-purchase pair frequencies. Symmetric matrix stored once (a < b).
CREATE MATERIALIZED VIEW IF NOT EXISTS public.product_copurchase_pairs AS
WITH eligible_orders AS (
  SELECT DISTINCT o.id
  FROM public.orders o
  WHERE o.status IN ('approved_ship','approved_pickup','in_fulfillment','shipped','delivered')
    AND COALESCE(o.is_wholesale_restock, false) = false
),
item_pairs AS (
  SELECT
    LEAST(a.product_id, b.product_id) AS product_a,
    GREATEST(a.product_id, b.product_id) AS product_b,
    COUNT(*) AS pair_count
  FROM public.order_items a
  JOIN public.order_items b ON a.order_id = b.order_id AND a.product_id < b.product_id
  JOIN eligible_orders o ON o.id = a.order_id
  WHERE a.product_id IS NOT NULL AND b.product_id IS NOT NULL
  GROUP BY 1, 2
)
SELECT product_a, product_b, pair_count FROM item_pairs;

CREATE UNIQUE INDEX IF NOT EXISTS product_copurchase_pairs_uniq
  ON public.product_copurchase_pairs (product_a, product_b);
CREATE INDEX IF NOT EXISTS product_copurchase_pairs_a_idx
  ON public.product_copurchase_pairs (product_a, pair_count DESC);
CREATE INDEX IF NOT EXISTS product_copurchase_pairs_b_idx
  ON public.product_copurchase_pairs (product_b, pair_count DESC);

-- Popular fallback. Top products by order item quantity in the last 60 days.
CREATE MATERIALIZED VIEW IF NOT EXISTS public.product_popular_60d AS
WITH recent AS (
  SELECT oi.product_id, SUM(oi.quantity) AS units
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.status IN ('approved_ship','approved_pickup','in_fulfillment','shipped','delivered')
    AND COALESCE(o.is_wholesale_restock, false) = false
    AND o.created_at >= NOW() - INTERVAL '60 days'
    AND oi.product_id IS NOT NULL
  GROUP BY 1
)
SELECT product_id, units FROM recent;

CREATE UNIQUE INDEX IF NOT EXISTS product_popular_60d_uniq
  ON public.product_popular_60d (product_id);
CREATE INDEX IF NOT EXISTS product_popular_60d_units_idx
  ON public.product_popular_60d (units DESC);

-- Wrapper: for a given product_id, return the top N co-purchased product_ids.
-- Symmetric: lookup is on BOTH sides of the matrix.
CREATE OR REPLACE FUNCTION public.get_copurchase_recommendations(p_product_id UUID, p_limit INT DEFAULT 6)
RETURNS TABLE (related_product_id UUID, pair_count BIGINT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT * FROM (
    SELECT product_b AS related_product_id, pair_count FROM public.product_copurchase_pairs WHERE product_a = p_product_id
    UNION ALL
    SELECT product_a AS related_product_id, pair_count FROM public.product_copurchase_pairs WHERE product_b = p_product_id
  ) s
  ORDER BY pair_count DESC, related_product_id
  LIMIT p_limit;
$$;
REVOKE EXECUTE ON FUNCTION public.get_copurchase_recommendations(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_copurchase_recommendations(UUID, INT) TO authenticated;

-- Wrapper: refresh both materialized views. Cron calls this.
CREATE OR REPLACE FUNCTION public.refresh_recommendation_views()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.product_copurchase_pairs;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.product_popular_60d;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_recommendation_views() FROM PUBLIC, anon, authenticated;

-- Plain (non-concurrent) refresh wrapper used by the cron only as a
-- fallback when CONCURRENTLY fails (typically on a cold view with no
-- existing data to diff against).
CREATE OR REPLACE FUNCTION public.refresh_recommendation_views_plain()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.product_copurchase_pairs;
  REFRESH MATERIALIZED VIEW public.product_popular_60d;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_recommendation_views_plain() FROM PUBLIC, anon, authenticated;
