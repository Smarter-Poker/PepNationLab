-- ============================================================================
-- PepNationLab Messenger Phase 11 - calls table.
-- One row per call session. Tracks status lifecycle.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messenger_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('audio','video')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','active','ended','missed','declined')),
  livekit_room TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mcl_calls_conv ON public.messenger_calls (conversation_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcl_calls_ringing ON public.messenger_calls (status) WHERE status = 'ringing';

ALTER TABLE public.messenger_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calls_select_participants ON public.messenger_calls;
CREATE POLICY calls_select_participants ON public.messenger_calls FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.messenger_participants p
            WHERE p.conversation_id = messenger_calls.conversation_id AND p.user_id = auth.uid())
);

DROP POLICY IF EXISTS calls_insert_initiator ON public.messenger_calls;
CREATE POLICY calls_insert_initiator ON public.messenger_calls FOR INSERT WITH CHECK (
  initiator_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.messenger_participants p
                WHERE p.conversation_id = messenger_calls.conversation_id AND p.user_id = auth.uid())
);

DROP POLICY IF EXISTS calls_update_participants ON public.messenger_calls;
CREATE POLICY calls_update_participants ON public.messenger_calls FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.messenger_participants p
            WHERE p.conversation_id = messenger_calls.conversation_id AND p.user_id = auth.uid())
);

-- Add to realtime publication so call signals push to clients.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messenger_calls') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_calls';
  END IF;
END $$;
