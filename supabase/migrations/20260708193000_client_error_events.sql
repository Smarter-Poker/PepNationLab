-- ============================================================================
-- Client-side error observability sink.
--
-- PepNationLab has the Sentry helper code but no DSN configured, so browser
-- errors currently go nowhere (a caught error in a client flow -- e.g. the match
-- drawer -- fails silently). This table is a lightweight, self-contained sink:
-- the rate-limited /api/observability/client-error route inserts rows with the
-- service role; a global window-error reporter and key catch blocks feed it.
--
-- Locked down: RLS on, NO insert/update/delete policies (writes happen only via
-- the service role through the audited endpoint, which bypasses RLS), and only
-- admins can read.
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_error_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  context     text,                       -- e.g. 'window.onerror', 'match', 'checkout'
  kind        text,                       -- 'error' | 'unhandledrejection' | 'caught'
  message     text NOT NULL,
  stack       text,
  url         text,
  user_agent  text,
  meta        jsonb
);

ALTER TABLE client_error_events ENABLE ROW LEVEL SECURITY;

-- Admins (and the service role, which bypasses RLS) can read. No other policies,
-- so authenticated/anon clients cannot read or write this table directly.
DROP POLICY IF EXISTS "Admins can read client error events" ON client_error_events;
CREATE POLICY "Admins can read client error events" ON client_error_events
  FOR SELECT USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_client_error_events_created
  ON client_error_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_error_events_context_created
  ON client_error_events (context, created_at DESC);
