-- agent_milestones: celebrates gamification milestones for agents
CREATE TABLE IF NOT EXISTS public.agent_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  milestone_type TEXT NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS agent_milestones_agent_id_idx ON public.agent_milestones(agent_id, achieved_at DESC);

ALTER TABLE public.agent_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage agent milestones" ON public.agent_milestones;
CREATE POLICY "Admins manage agent milestones" ON public.agent_milestones
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Agents view own milestones" ON public.agent_milestones;
CREATE POLICY "Agents view own milestones" ON public.agent_milestones
  FOR SELECT USING (agent_id = auth.uid());
