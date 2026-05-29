-- ============================================================================
-- PepNationLab Messenger Phase 5 - edit history + message dismissals
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messenger_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messenger_messages(id) ON DELETE CASCADE,
  previous_text TEXT,
  edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meh_message ON public.messenger_edit_history (message_id);

ALTER TABLE public.messenger_edit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meh_select_participants ON public.messenger_edit_history;
CREATE POLICY meh_select_participants ON public.messenger_edit_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.messenger_messages m
      JOIN public.messenger_participants p ON p.conversation_id = m.conversation_id
     WHERE m.id = messenger_edit_history.message_id
       AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS meh_insert_admin ON public.messenger_edit_history;
CREATE POLICY meh_insert_admin ON public.messenger_edit_history FOR INSERT WITH CHECK (
  edited_by = auth.uid()
);

CREATE TABLE IF NOT EXISTS public.messenger_message_dismissals (
  message_id UUID NOT NULL REFERENCES public.messenger_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mmd_user ON public.messenger_message_dismissals (user_id);

ALTER TABLE public.messenger_message_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mmd_select_self ON public.messenger_message_dismissals;
CREATE POLICY mmd_select_self ON public.messenger_message_dismissals FOR SELECT USING (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS mmd_insert_self ON public.messenger_message_dismissals;
CREATE POLICY mmd_insert_self ON public.messenger_message_dismissals FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS mmd_delete_self ON public.messenger_message_dismissals;
CREATE POLICY mmd_delete_self ON public.messenger_message_dismissals FOR DELETE USING (
  user_id = auth.uid()
);
