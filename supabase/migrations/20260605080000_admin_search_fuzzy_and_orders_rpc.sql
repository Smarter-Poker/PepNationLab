-- fix-49: pg_trgm fuzzy search for /admin/search.
--
-- Two parts:
--   1. Trigram GIN indexes on every column the global search hits, so
--      ILIKE '%foo%' with leading wildcards stops doing seqscans.
--   2. fn_admin_search_orders RPC — the user asked for "every possible way
--      to search orders" plus fuzzy matching. The function combines ILIKE
--      substring + trigram word_similarity + JSONB shipping_address lookup
--      + order_items × products subquery, with optional structured filters
--      for status / payment_method / agent / date range / amount range.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE INDEX IF NOT EXISTS idx_orders_buyer_name_trgm        ON public.orders          USING gin (buyer_name        gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_email_trgm       ON public.orders          USING gin (buyer_email       gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number_trgm   ON public.orders          USING gin (tracking_number   gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm       ON public.profiles        USING gin (full_name         gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm        ON public.profiles        USING gin (username          gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm           ON public.profiles        USING gin (email             gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm            ON public.products        USING gin (name              gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_slug_trgm            ON public.products        USING gin (slug              gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm             ON public.products        USING gin (sku               gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_slug_trgm      ON public.agent_profiles  USING gin (slug              gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_displayname_t  ON public.agent_profiles  USING gin (display_name      gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_coupons_code_trgm             ON public.coupons         USING gin (code              gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_balance_tx_description_trgm   ON public.balance_transactions USING gin (description   gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.fn_admin_search_orders(
  p_query           text        DEFAULT NULL,
  p_status          text        DEFAULT NULL,
  p_payment_method  text        DEFAULT NULL,
  p_agent_id        uuid        DEFAULT NULL,
  p_date_from       timestamptz DEFAULT NULL,
  p_date_to         timestamptz DEFAULT NULL,
  p_min_total       numeric     DEFAULT NULL,
  p_max_total       numeric     DEFAULT NULL,
  p_limit           int         DEFAULT 50
)
RETURNS TABLE (
  id              uuid,
  buyer_name      text,
  buyer_email     text,
  tracking_number text,
  status          text,
  total           numeric,
  created_at      timestamptz,
  agent_id        uuid,
  payment_method  text,
  match_score     real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  q text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin Only';
  END IF;

  q := nullif(trim(coalesce(p_query, '')), '');

  RETURN QUERY
  SELECT
    o.id,
    o.buyer_name,
    o.buyer_email,
    o.tracking_number,
    o.status::text,
    o.total,
    o.created_at,
    o.agent_id,
    o.payment_method::text,
    CASE
      WHEN q IS NULL THEN 0::real
      ELSE GREATEST(
        similarity(coalesce(o.buyer_name, ''),      q),
        similarity(coalesce(o.buyer_email, ''),     q),
        similarity(coalesce(o.tracking_number, ''), q),
        similarity(coalesce(o.shipping_address->>'zip',  ''), q),
        similarity(coalesce(o.shipping_address->>'city', ''), q),
        similarity(o.id::text, q)
      )::real
    END AS match_score
  FROM public.orders o
  WHERE
    (
      q IS NULL
      OR o.buyer_name           ILIKE '%' || q || '%'
      OR o.buyer_email          ILIKE '%' || q || '%'
      OR o.tracking_number      ILIKE '%' || q || '%'
      OR o.id::text             ILIKE '%' || q || '%'
      OR o.status::text         ILIKE '%' || q || '%'
      OR o.payment_method::text ILIKE '%' || q || '%'
      OR o.fulfillment_method   ILIKE '%' || q || '%'
      OR o.coupon_code          ILIKE '%' || q || '%'
      OR o.shipping_address->>'zip'    ILIKE '%' || q || '%'
      OR o.shipping_address->>'city'   ILIKE '%' || q || '%'
      OR o.shipping_address->>'state'  ILIKE '%' || q || '%'
      OR o.carrier              ILIKE '%' || q || '%'
      OR o.service_level        ILIKE '%' || q || '%'
      OR similarity(coalesce(o.buyer_name, ''),  q) > 0.3
      OR similarity(coalesce(o.buyer_email, ''), q) > 0.3
      OR EXISTS (
        SELECT 1 FROM public.order_items oi
        JOIN public.products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id
          AND (
            p.name ILIKE '%' || q || '%'
            OR p.slug ILIKE '%' || q || '%'
            OR p.sku ILIKE '%' || q || '%'
            OR similarity(coalesce(p.name, ''), q) > 0.3
          )
      )
    )
    AND (p_status         IS NULL OR o.status::text         = p_status)
    AND (p_payment_method IS NULL OR o.payment_method::text = p_payment_method)
    AND (p_agent_id       IS NULL OR o.agent_id             = p_agent_id)
    AND (p_date_from      IS NULL OR o.created_at >= p_date_from)
    AND (p_date_to        IS NULL OR o.created_at <= p_date_to)
    AND (p_min_total      IS NULL OR o.total >= p_min_total)
    AND (p_max_total      IS NULL OR o.total <= p_max_total)
  ORDER BY
    CASE WHEN q IS NULL THEN 0 ELSE 1 END,
    match_score DESC,
    o.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_search_orders(text, text, text, uuid, timestamptz, timestamptz, numeric, numeric, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_admin_search_orders(text, text, text, uuid, timestamptz, timestamptz, numeric, numeric, int) TO authenticated, service_role;
