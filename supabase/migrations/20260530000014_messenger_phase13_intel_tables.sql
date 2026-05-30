-- ============================================================================
-- PepNationLab Messenger Phase 13 - Intelligence tables.
-- Reminders, @admin mentions, favorites.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messenger_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messenger_messages(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.messenger_conversations(id) ON DELETE SET NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  message_preview TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fired','cancelled','dismissed')),
  fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mrm_user_status ON public.messenger_reminders (user_id, status);
CREATE INDEX IF NOT EXISTS idx_mrm_due ON public.messenger_reminders (remind_at) WHERE status = 'pending';

ALTER TABLE public.messenger_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mrm_all_self ON public.messenger_reminders;
CREATE POLICY mrm_all_self ON public.messenger_reminders FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.messenger_admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messenger_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message_text TEXT,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read','resolved')),
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mam_status ON public.messenger_admin_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mam_message ON public.messenger_admin_messages (message_id);

ALTER TABLE public.messenger_admin_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mam_select_admin ON public.messenger_admin_messages;
CREATE POLICY mam_select_admin ON public.messenger_admin_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS mam_insert_authenticated ON public.messenger_admin_messages;
CREATE POLICY mam_insert_authenticated ON public.messenger_admin_messages FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS mam_update_admin ON public.messenger_admin_messages;
CREATE POLICY mam_update_admin ON public.messenger_admin_messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE TABLE IF NOT EXISTS public.messenger_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  favorite_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, favorite_user_id),
  CHECK (user_id <> favorite_user_id)
);
CREATE INDEX IF NOT EXISTS idx_mfv_user ON public.messenger_favorites (user_id);

ALTER TABLE public.messenger_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mfv_all_self ON public.messenger_favorites;
CREATE POLICY mfv_all_self ON public.messenger_favorites FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
