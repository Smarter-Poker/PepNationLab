-- Agent broadcast log: one row per broadcast an agent sends to their researchers.
-- NOTE: Applied to production 2026-07-11 via MCP; this file recovered from
-- supabase_migrations.schema_migrations so the repo matches prod history.
CREATE TABLE IF NOT EXISTS public.agent_broadcasts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  url             TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_broadcasts_agent_idx
  ON public.agent_broadcasts (agent_id, created_at DESC);

ALTER TABLE public.agent_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents read own broadcasts" ON public.agent_broadcasts;
CREATE POLICY "Agents read own broadcasts" ON public.agent_broadcasts
  FOR SELECT
  USING (agent_id = (SELECT auth.uid()) OR public.is_admin());
