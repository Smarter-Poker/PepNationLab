-- ============================================================================
-- PepNationLab Messenger Phase 12 - Safety: blocks + reports.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messenger_blocked (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_mbk_blocker ON public.messenger_blocked (blocker_id);
CREATE INDEX IF NOT EXISTS idx_mbk_blocked ON public.messenger_blocked (blocked_id);

ALTER TABLE public.messenger_blocked ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mblk_select_own ON public.messenger_blocked;
CREATE POLICY mblk_select_own ON public.messenger_blocked FOR SELECT USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS mblk_insert_self ON public.messenger_blocked;
CREATE POLICY mblk_insert_self ON public.messenger_blocked FOR INSERT WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS mblk_delete_own ON public.messenger_blocked;
CREATE POLICY mblk_delete_own ON public.messenger_blocked FOR DELETE USING (blocker_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.messenger_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  message_id UUID NOT NULL REFERENCES public.messenger_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam','harassment','inappropriate','scam','other')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mrpt_status ON public.messenger_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mrpt_reporter ON public.messenger_reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_mrpt_message ON public.messenger_reports (message_id);

ALTER TABLE public.messenger_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mrpt_select_self_or_admin ON public.messenger_reports;
CREATE POLICY mrpt_select_self_or_admin ON public.messenger_reports FOR SELECT USING (
  reporter_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS mrpt_insert_self ON public.messenger_reports;
CREATE POLICY mrpt_insert_self ON public.messenger_reports FOR INSERT WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS mrpt_update_admin ON public.messenger_reports;
CREATE POLICY mrpt_update_admin ON public.messenger_reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
