-- CRM: private per-researcher notes an agent keeps about their researchers.
-- One note document per (agent, researcher) pair.
CREATE TABLE IF NOT EXISTS public.agent_researcher_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  researcher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, researcher_id)
);

CREATE INDEX IF NOT EXISTS idx_arn_agent ON public.agent_researcher_notes (agent_id);

ALTER TABLE public.agent_researcher_notes ENABLE ROW LEVEL SECURITY;

-- Only the owning agent can read their own private notes.
DROP POLICY IF EXISTS arn_select_own ON public.agent_researcher_notes;
CREATE POLICY arn_select_own ON public.agent_researcher_notes
  FOR SELECT USING (auth.uid() = agent_id);

-- Insert/update bound to the calling agent (WITH CHECK prevents attribution forgery).
DROP POLICY IF EXISTS arn_insert_own ON public.agent_researcher_notes;
CREATE POLICY arn_insert_own ON public.agent_researcher_notes
  FOR INSERT WITH CHECK (auth.uid() = agent_id);

DROP POLICY IF EXISTS arn_update_own ON public.agent_researcher_notes;
CREATE POLICY arn_update_own ON public.agent_researcher_notes
  FOR UPDATE USING (auth.uid() = agent_id) WITH CHECK (auth.uid() = agent_id);

DROP POLICY IF EXISTS arn_delete_own ON public.agent_researcher_notes;
CREATE POLICY arn_delete_own ON public.agent_researcher_notes
  FOR DELETE USING (auth.uid() = agent_id);

COMMENT ON TABLE public.agent_researcher_notes IS
  'CRM private notes: one note doc per (agent_id, researcher_id). Agent-owned, RLS-gated.';
