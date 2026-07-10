-- Migration: slug_reservations fix + consume_slug_reservation RPC
-- Both tables already exist in remote (created via dashboard) but:
-- 1. slug_reservations is missing the `consumed` column used by the RPC
-- 2. consume_slug_reservation function was never defined despite being
--    referenced in GRANT/REVOKE migrations and called in the app
-- 3. reserved_slugs is missing its RLS policies

-- ─────────────────────────────────────────────
-- 1. reserved_slugs — ensure RLS + policies exist
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reserved_slugs (
  slug text PRIMARY KEY
);
ALTER TABLE public.reserved_slugs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='reserved_slugs' AND policyname='reserved_slugs_admin_all'
  ) THEN
    EXECUTE 'CREATE POLICY reserved_slugs_admin_all ON public.reserved_slugs FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = ''admin''))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = ''admin''))';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='reserved_slugs' AND policyname='reserved_slugs_public_read'
  ) THEN
    EXECUTE 'CREATE POLICY reserved_slugs_public_read ON public.reserved_slugs FOR SELECT TO anon, authenticated USING (true)';
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 2. slug_reservations — add missing columns if not present
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.slug_reservations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token      uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  field      text NOT NULL,
  normalized text NOT NULL,
  ip         text,
  exclude_id text,
  consumed   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);

-- Add columns that may be missing on pre-existing tables
ALTER TABLE public.slug_reservations
  ADD COLUMN IF NOT EXISTS consumed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes');

-- Indexes with partial predicate (only valid when column exists)
CREATE INDEX IF NOT EXISTS idx_slug_reservations_token_active
  ON public.slug_reservations (token);
CREATE INDEX IF NOT EXISTS idx_slug_reservations_cleanup
  ON public.slug_reservations (expires_at);

ALTER TABLE public.slug_reservations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='slug_reservations' AND policyname='slug_reservations_service_only'
  ) THEN
    EXECUTE 'CREATE POLICY slug_reservations_service_only ON public.slug_reservations FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 3. consume_slug_reservation RPC
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consume_slug_reservation(
  p_token      uuid,
  p_field      text,
  p_normalized text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.slug_reservations
  SET    consumed = true
  WHERE  token      = p_token
    AND  field      = p_field
    AND  normalized = lower(p_normalized)
    AND  consumed   = false
    AND  expires_at > now()
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_slug_reservation(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.consume_slug_reservation(uuid, text, text) TO service_role;
