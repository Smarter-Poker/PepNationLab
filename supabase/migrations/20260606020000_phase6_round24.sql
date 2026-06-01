-- R24 Phase 6 — Theme builder, custom domains, org chart support
BEGIN;

ALTER TABLE public.agent_profiles
  ADD COLUMN IF NOT EXISTS theme_config    JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS secondary_color TEXT,
  ADD COLUMN IF NOT EXISTS accent_color    TEXT,
  ADD COLUMN IF NOT EXISTS tagline         TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_url  TEXT;

CREATE TABLE IF NOT EXISTS public.agent_domains (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hostname    TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  verified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS agent_domains_agent_idx ON public.agent_domains (agent_id, status);
ALTER TABLE public.agent_domains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_domains_self ON public.agent_domains;
CREATE POLICY agent_domains_self ON public.agent_domains FOR ALL TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin())
  WITH CHECK (agent_id = auth.uid() OR public.is_admin());

-- Org chart RPC (recursive over referring_agent_id + parent_agent_id)
CREATE OR REPLACE FUNCTION public.agent_team_org_chart(p_root UUID)
RETURNS TABLE (
  id              UUID,
  parent_id       UUID,
  full_name       TEXT,
  username        TEXT,
  role            TEXT,
  depth           INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501'; END IF;
  IF v_caller <> p_root AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH RECURSIVE tree AS (
    SELECT p.id, p.parent_agent_id AS parent_id,
           p.full_name, p.username, p.role::TEXT, 0 AS depth
      FROM public.profiles p
     WHERE p.id = p_root
    UNION ALL
    SELECT p.id, p.parent_agent_id, p.full_name, p.username, p.role::TEXT, t.depth + 1
      FROM public.profiles p
      JOIN tree t ON p.parent_agent_id = t.id
     WHERE t.depth < 5
  )
  SELECT * FROM tree;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_team_org_chart(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_team_org_chart(UUID) TO authenticated, service_role;

COMMIT;
