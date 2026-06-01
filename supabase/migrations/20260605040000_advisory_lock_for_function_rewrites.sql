-- Migration ordering pattern for high-risk function rewrites.
--
-- Background: the 2026-05-31 prod outage repeated because two sessions
-- raced on protect_profile_columns(). v1 fixed it, then a follow-up
-- migration silently reapplied the buggy version. We need a serialization
-- primitive so future rewrites of dangerous trigger functions either
-- succeed-or-conflict instead of last-writer-wins.
--
-- Pattern:
--   1. Pick a stable bigint key per function (guarded_function_lock_key).
--   2. Take pg_advisory_xact_lock at the top of the migration.
--   3. The next migration that touches the same function blocks until
--      this one commits, then sees the up-to-date state and can decide
--      whether to overwrite.
--
-- Plus: a tiny audit table function_rewrites recording every CREATE OR
-- REPLACE FUNCTION on a guarded function. Operators can read this to see
-- the sequence of changes and catch silent reverts.

CREATE TABLE IF NOT EXISTS public.function_rewrites (
  id BIGSERIAL PRIMARY KEY,
  function_name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by TEXT,
  body_hash TEXT,
  body_preview TEXT,
  migration_name TEXT
);
ALTER TABLE public.function_rewrites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read function_rewrites" ON public.function_rewrites;
CREATE POLICY "Admins read function_rewrites" ON public.function_rewrites
  FOR SELECT USING (public.is_admin());

CREATE INDEX IF NOT EXISTS function_rewrites_function_name_idx
  ON public.function_rewrites (function_name, applied_at DESC);

CREATE OR REPLACE FUNCTION public.guarded_function_lock_key(p_function_name TEXT)
RETURNS BIGINT LANGUAGE SQL IMMUTABLE AS $$
  SELECT ('x' || substr(md5(p_function_name), 1, 16))::bit(64)::bigint;
$$;

CREATE OR REPLACE FUNCTION public.lock_guarded_function(p_function_name TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(public.guarded_function_lock_key(p_function_name));
END;
$$;

CREATE OR REPLACE FUNCTION public.record_function_rewrite(
  p_function_name TEXT,
  p_body TEXT,
  p_migration_name TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE SQL AS $$
  INSERT INTO public.function_rewrites
    (function_name, applied_by, body_hash, body_preview, migration_name)
  VALUES
    (p_function_name, current_user, md5(p_body), LEFT(p_body, 500), p_migration_name);
$$;

DO $$
DECLARE
  v_body TEXT;
BEGIN
  SELECT pg_get_functiondef('public.protect_profile_columns'::regproc) INTO v_body;
  PERFORM public.record_function_rewrite(
    'protect_profile_columns', v_body,
    '20260605040000_advisory_lock_for_function_rewrites'
  );
END $$;

-- Usage pattern for future high-risk rewrites:
--
--   BEGIN;
--   SELECT public.lock_guarded_function('protect_profile_columns');
--   CREATE OR REPLACE FUNCTION public.protect_profile_columns() ...;
--   SELECT public.record_function_rewrite(
--     'protect_profile_columns',
--     pg_get_functiondef('public.protect_profile_columns'::regproc),
--     '<migration_filename>'
--   );
--   COMMIT;
