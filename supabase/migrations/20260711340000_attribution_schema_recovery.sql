-- =============================================================================
-- MARKETING ATTRIBUTION SCHEMA RECOVERY (SENTINEL Analytics Audit -- gap closure)
--
-- The marketing_attribution table, the record_attribution / stamp_attribution_on_order
-- RPCs, and the trg_stamp_attribution_on_order trigger were applied to production
-- directly (via MCP) and never checked into the repo -- schema drift that made the
-- attribution pipeline unreviewable and non-reproducible.
--
-- This migration is a faithful, idempotent recovery of the live objects
-- (dumped from prod project ydsaqnnuwyvtyxgvrnys). Applying it to prod is a
-- no-op; applying it to a fresh database reproduces the pipeline exactly.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_attribution (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id         TEXT NOT NULL UNIQUE,
  user_id            UUID,
  first_touch_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_utm_source   TEXT,
  first_utm_medium   TEXT,
  first_utm_campaign TEXT,
  first_utm_content  TEXT,
  first_utm_term     TEXT,
  first_referrer     TEXT,
  first_landing_path TEXT,
  last_touch_at      TIMESTAMPTZ,
  last_utm_source    TEXT,
  last_utm_medium    TEXT,
  last_utm_campaign  TEXT,
  last_utm_content   TEXT,
  last_utm_term      TEXT,
  signed_up_at       TIMESTAMPTZ,
  order_id           UUID,
  revenue_cents      INTEGER,
  converted_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attribution_user_idx      ON public.marketing_attribution(user_id);
CREATE INDEX IF NOT EXISTS attribution_order_idx     ON public.marketing_attribution(order_id);
CREATE INDEX IF NOT EXISTS attribution_first_src_idx ON public.marketing_attribution(first_utm_source);

-- RLS on, no client policies: only the service role (record_attribution RPC) and
-- admin reporting views may touch it. A visitor->user->UTM map must not be
-- readable by anon/authenticated roles.
ALTER TABLE public.marketing_attribution ENABLE ROW LEVEL SECURITY;

-- First/last-touch upsert, keyed on visitor_id. First-touch is immutable;
-- last-touch refreshes; user_id and signed_up_at latch on first non-null.
CREATE OR REPLACE FUNCTION public.record_attribution(
  p_visitor_id text,
  p_user_id uuid DEFAULT NULL,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_utm_content text DEFAULT NULL,
  p_utm_term text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_landing_path text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if p_visitor_id is null or length(trim(p_visitor_id)) = 0 then
    return;
  end if;

  insert into public.marketing_attribution (
    visitor_id, user_id,
    first_touch_at, first_utm_source, first_utm_medium, first_utm_campaign,
    first_utm_content, first_utm_term, first_referrer, first_landing_path,
    last_touch_at, last_utm_source, last_utm_medium, last_utm_campaign,
    last_utm_content, last_utm_term,
    signed_up_at
  ) values (
    p_visitor_id, p_user_id,
    now(), p_utm_source, p_utm_medium, p_utm_campaign,
    p_utm_content, p_utm_term, p_referrer, p_landing_path,
    now(), p_utm_source, p_utm_medium, p_utm_campaign,
    p_utm_content, p_utm_term,
    case when p_user_id is not null then now() else null end
  )
  on conflict (visitor_id) do update set
    user_id        = coalesce(public.marketing_attribution.user_id, excluded.user_id),
    signed_up_at   = coalesce(public.marketing_attribution.signed_up_at,
                              case when excluded.user_id is not null then now() else null end),
    last_touch_at  = now(),
    last_utm_source   = coalesce(excluded.last_utm_source,   public.marketing_attribution.last_utm_source),
    last_utm_medium   = coalesce(excluded.last_utm_medium,   public.marketing_attribution.last_utm_medium),
    last_utm_campaign = coalesce(excluded.last_utm_campaign, public.marketing_attribution.last_utm_campaign),
    last_utm_content  = coalesce(excluded.last_utm_content,  public.marketing_attribution.last_utm_content),
    last_utm_term     = coalesce(excluded.last_utm_term,     public.marketing_attribution.last_utm_term),
    updated_at     = now();
end;
$$;

REVOKE ALL ON FUNCTION public.record_attribution(text,uuid,text,text,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_attribution(text,uuid,text,text,text,text,text,text,text) FROM anon;
REVOKE ALL ON FUNCTION public.record_attribution(text,uuid,text,text,text,text,text,text,text) FROM authenticated;

-- Stamp the buyer's most recent unconverted attribution row when an order is placed.
CREATE OR REPLACE FUNCTION public.stamp_attribution_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if new.buyer_id is null then
    return new;
  end if;

  update public.marketing_attribution ma
     set order_id      = new.id,
         revenue_cents = greatest(0, round(coalesce(new.total, 0) * 100))::int,
         converted_at  = now(),
         updated_at    = now()
   where ma.id = (
     select id from public.marketing_attribution
      where user_id = new.buyer_id
        and order_id is null
      order by coalesce(last_touch_at, first_touch_at) desc
      limit 1
   );

  return new;
end;
$$;

REVOKE ALL ON FUNCTION public.stamp_attribution_on_order() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stamp_attribution_on_order() FROM anon;
REVOKE ALL ON FUNCTION public.stamp_attribution_on_order() FROM authenticated;

DROP TRIGGER IF EXISTS trg_stamp_attribution_on_order ON public.orders;
CREATE TRIGGER trg_stamp_attribution_on_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_attribution_on_order();
