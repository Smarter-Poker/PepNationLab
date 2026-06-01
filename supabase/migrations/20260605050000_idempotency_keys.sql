-- Generic per-user idempotency layer for admin and agent POSTs that mutate
-- money or state. Stripe-style: a client supplies an `Idempotency-Key`
-- header (UUIDv4 recommended), we cache the response for 24 hours scoped
-- to that user, and a replay with the same key returns the cached response
-- rather than re-executing the handler.
--
-- Used by lib/idempotency.ts:withIdempotency().
--
-- Lifetime: 24 hours from first insert. A daily cron may DELETE expired
-- rows; until then, they're just dead weight.
--
-- Why a generic table rather than per-table client_idempotency_key columns:
--   - Bulk admin actions (bulk-approve, bulk-mark-paid) mutate many rows
--     and the natural caching unit is the response, not a single inserted
--     row. A generic table cleanly captures that.
--   - Routes that don't have a target table at all (refund flows that
--     chain through multiple tables) still benefit.
--   - We keep orders.idempotency_key for the order-create path so the
--     existing replay-on-unique-violation pattern still works.

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key             text         NOT NULL PRIMARY KEY,
  user_id         uuid         NOT NULL,
  route           text         NOT NULL,
  request_hash    text         NOT NULL,
  response_status int          NOT NULL DEFAULT 0,
  response_body   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  expires_at      timestamptz  NOT NULL DEFAULT (now() + interval '24 hours')
);

COMMENT ON TABLE public.idempotency_keys IS
  'Caches POST/PATCH responses keyed by client Idempotency-Key header. Owned by user_id, scoped by route + request_hash. 24h TTL.';

COMMENT ON COLUMN public.idempotency_keys.response_status IS
  '0 while the handler is in flight; HTTP status (2xx/4xx) once cached. 5xx responses are NOT cached — the row is deleted so the client may retry.';

CREATE INDEX IF NOT EXISTS idempotency_keys_user_id_route_idx
  ON public.idempotency_keys (user_id, route);

CREATE INDEX IF NOT EXISTS idempotency_keys_expires_at_idx
  ON public.idempotency_keys (expires_at);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users read own idempotency keys"
  ON public.idempotency_keys FOR SELECT
  USING (user_id = auth.uid());
