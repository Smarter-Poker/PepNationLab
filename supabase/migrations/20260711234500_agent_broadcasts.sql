-- Agent Broadcasts: a general researcher-announcement channel.
--
-- Generalizes the coupon-only notify-downline path so an agent can send a
-- custom announcement (new stock, restock, message) to every active researcher
-- in their downline via the existing notify() (in-app + web push) plumbing.
-- This table is the send history. Enhancement roadmap Phase C.

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

-- Agents see and manage only their own broadcast history. Inserts are written
-- by the send route with the service-role client; this policy covers direct
-- reads from the dashboard.
DROP POLICY IF EXISTS "Agents read own broadcasts" ON public.agent_broadcasts;
CREATE POLICY "Agents read own broadcasts" ON public.agent_broadcasts
  FOR SELECT
  USING (agent_id = (SELECT auth.uid()) OR public.is_admin());
