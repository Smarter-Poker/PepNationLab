-- ============================================================================
-- PepNationLab Messenger Phase 0 Schema
-- Mirrors Smarter.Poker messenger_* tables. Single source of truth for
-- conversations, participants, messages, and reactions.
--
-- Audit notes (Phase 0 line-by-line review, 2026-05-29):
--   1) Original plan declared inline UNIQUE(message_id, user_id,
--      COALESCE(emoji, gif_url)) on messenger_reactions. Postgres does not
--      accept expressions inside an inline UNIQUE constraint -- syntax
--      verified to fail with "syntax error at or near ("". Re-expressed as
--      a unique INDEX with the COALESCE expression, which is the supported
--      Postgres equivalent and enforces the same dedupe semantics.
--   2) RLS policies that reference messenger_participants from inside an
--      EXISTS subquery must qualify the OUTER row's conversation_id;
--      otherwise the unqualified ref resolves to the inner alias and the
--      check degenerates to "any row exists", letting non-participants
--      read or write the conversation. Verified empirically on this
--      project. All affected policies (mp_*, mm_*, mr_*) now use the
--      outer table alias.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messenger_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct','group','announcement')),
  title TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_archived BOOLEAN DEFAULT false,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messenger_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','moderator','member')),
  is_muted BOOLEAN DEFAULT false,
  mute_until TIMESTAMPTZ,
  is_pinned BOOLEAN DEFAULT false,
  unread_count INTEGER DEFAULT 0,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  last_read_message_id UUID,
  settings JSONB DEFAULT '{}'::jsonb,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messenger_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT,
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text','image','gif','voice','file','contact_card','location','poll','system')),
  media_url TEXT,
  media_metadata JSONB DEFAULT '{}'::jsonb,
  reply_to_id UUID REFERENCES public.messenger_messages(id) ON DELETE SET NULL,
  thread_parent_id UUID REFERENCES public.messenger_messages(id) ON DELETE CASCADE,
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  delete_scope TEXT CHECK (delete_scope IN ('for_me','for_everyone')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal','urgent','important','low')),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent','delivered','read')),
  labels TEXT[] DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messenger_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messenger_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'emoji' CHECK (reaction_type IN ('emoji','gif')),
  emoji TEXT,
  gif_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique dedupe on (message, user, reaction-token). Expression-based unique
-- constraints must be declared as a UNIQUE INDEX, not as an inline
-- UNIQUE table constraint -- see audit note (1) at the top of this file.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mr_message_user_token
  ON public.messenger_reactions (message_id, user_id, COALESCE(emoji, gif_url));

CREATE INDEX IF NOT EXISTS idx_mc_last_at ON public.messenger_conversations (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_user ON public.messenger_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_mp_conv ON public.messenger_participants (conversation_id);
CREATE INDEX IF NOT EXISTS idx_mm_conv_created ON public.messenger_messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mm_sender ON public.messenger_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_mm_reply ON public.messenger_messages (reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mm_thread ON public.messenger_messages (thread_parent_id) WHERE thread_parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mm_expires ON public.messenger_messages (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mr_msg ON public.messenger_reactions (message_id);

ALTER TABLE public.messenger_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messenger_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messenger_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messenger_reactions ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- messenger_conversations policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mc_select_participants ON public.messenger_conversations;
CREATE POLICY mc_select_participants ON public.messenger_conversations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.messenger_participants p
    WHERE p.conversation_id = messenger_conversations.id
      AND p.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS mc_insert_self ON public.messenger_conversations;
CREATE POLICY mc_insert_self ON public.messenger_conversations FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS mc_update_admins ON public.messenger_conversations;
CREATE POLICY mc_update_admins ON public.messenger_conversations FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.messenger_participants p
    WHERE p.conversation_id = messenger_conversations.id
      AND p.user_id = auth.uid()
      AND p.role IN ('owner','admin')
  )
);

-- ----------------------------------------------------------------------------
-- messenger_participants policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mp_select_own_conv ON public.messenger_participants;
CREATE POLICY mp_select_own_conv ON public.messenger_participants FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.messenger_participants p2
    WHERE p2.conversation_id = messenger_participants.conversation_id
      AND p2.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS mp_insert_admin ON public.messenger_participants;
CREATE POLICY mp_insert_admin ON public.messenger_participants FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.messenger_participants p
    WHERE p.conversation_id = messenger_participants.conversation_id
      AND p.user_id = auth.uid()
      AND p.role IN ('owner','admin')
  )
);

DROP POLICY IF EXISTS mp_update_self ON public.messenger_participants;
CREATE POLICY mp_update_self ON public.messenger_participants FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS mp_delete_self_or_admin ON public.messenger_participants;
CREATE POLICY mp_delete_self_or_admin ON public.messenger_participants FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.messenger_participants p
    WHERE p.conversation_id = messenger_participants.conversation_id
      AND p.user_id = auth.uid()
      AND p.role IN ('owner','admin')
  )
);

-- ----------------------------------------------------------------------------
-- messenger_messages policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mm_select_participants ON public.messenger_messages;
CREATE POLICY mm_select_participants ON public.messenger_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.messenger_participants p
    WHERE p.conversation_id = messenger_messages.conversation_id
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS mm_insert_self_in_conv ON public.messenger_messages;
CREATE POLICY mm_insert_self_in_conv ON public.messenger_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.messenger_participants p
    WHERE p.conversation_id = messenger_messages.conversation_id
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS mm_update_self ON public.messenger_messages;
CREATE POLICY mm_update_self ON public.messenger_messages FOR UPDATE USING (sender_id = auth.uid());

-- ----------------------------------------------------------------------------
-- messenger_reactions policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS mr_select_participants ON public.messenger_reactions;
CREATE POLICY mr_select_participants ON public.messenger_reactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.messenger_messages m
    JOIN public.messenger_participants p ON p.conversation_id = m.conversation_id
    WHERE m.id = messenger_reactions.message_id
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS mr_insert_self ON public.messenger_reactions;
CREATE POLICY mr_insert_self ON public.messenger_reactions FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS mr_delete_self ON public.messenger_reactions;
CREATE POLICY mr_delete_self ON public.messenger_reactions FOR DELETE USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Trigger: maintain conversation summary + unread counts on new message
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_mm_after_insert() RETURNS trigger AS $$
BEGIN
  UPDATE public.messenger_conversations
     SET last_message_text = LEFT(COALESCE(NEW.text, '[' || NEW.message_type || ']'), 200),
         last_message_at = NEW.created_at,
         updated_at = now()
   WHERE id = NEW.conversation_id;

  UPDATE public.messenger_participants
     SET unread_count = unread_count + 1
   WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_mm_after_insert ON public.messenger_messages;
CREATE TRIGGER trg_mm_after_insert AFTER INSERT ON public.messenger_messages
FOR EACH ROW EXECUTE FUNCTION public.fn_mm_after_insert();

-- ----------------------------------------------------------------------------
-- Storage bucket for messenger media (images, gifs, voice, files)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'messenger_media','messenger_media',true,52428800,
  ARRAY['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm',
        'audio/webm','audio/mp4','audio/mpeg','application/pdf']
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload messenger media" ON storage.objects;
CREATE POLICY "Authenticated users can upload messenger media" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'messenger_media');

DROP POLICY IF EXISTS "Public read access for messenger media" ON storage.objects;
CREATE POLICY "Public read access for messenger media" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'messenger_media');

DROP POLICY IF EXISTS "Users can delete their own messenger media" ON storage.objects;
CREATE POLICY "Users can delete their own messenger media" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'messenger_media' AND auth.uid()::text = (storage.foldername(name))[1]
);
