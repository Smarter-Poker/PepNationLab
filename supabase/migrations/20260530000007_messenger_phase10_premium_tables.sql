-- ============================================================================
-- PepNationLab Messenger Phase 10 - Premium UX tables.
-- pins, bookmarks, labels, themes, scheduled, templates, conversation_labels.
-- Thread replies reuse existing messenger_messages.thread_parent_id.
-- Expiry timer reuses existing messenger_messages.expires_at.
-- Applied to Supabase ydsaqnnuwyvtyxgvrnys as messenger_phase10_premium_tables.
-- ============================================================================

-- 1. Pinned messages (per-conversation, max 1 row per message).
CREATE TABLE IF NOT EXISTS public.messenger_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messenger_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id)
);
CREATE INDEX IF NOT EXISTS idx_mpin_conv ON public.messenger_pins (conversation_id);
ALTER TABLE public.messenger_pins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mpin_select_participants ON public.messenger_pins;
CREATE POLICY mpin_select_participants ON public.messenger_pins FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.messenger_participants p
            WHERE p.conversation_id = messenger_pins.conversation_id AND p.user_id = auth.uid())
);
DROP POLICY IF EXISTS mpin_insert_participants ON public.messenger_pins;
CREATE POLICY mpin_insert_participants ON public.messenger_pins FOR INSERT WITH CHECK (
  pinned_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.messenger_participants p
                WHERE p.conversation_id = messenger_pins.conversation_id AND p.user_id = auth.uid())
);
DROP POLICY IF EXISTS mpin_delete_admin_or_self ON public.messenger_pins;
CREATE POLICY mpin_delete_admin_or_self ON public.messenger_pins FOR DELETE USING (
  pinned_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.messenger_participants p
               WHERE p.conversation_id = messenger_pins.conversation_id
                 AND p.user_id = auth.uid() AND p.role IN ('owner','admin'))
);

-- 2. Bookmarks (per-user).
CREATE TABLE IF NOT EXISTS public.messenger_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messenger_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_mbk_user ON public.messenger_bookmarks (user_id);
ALTER TABLE public.messenger_bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mbk_all_self ON public.messenger_bookmarks;
CREATE POLICY mbk_all_self ON public.messenger_bookmarks FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. Labels (per-user, fixed enum).
CREATE TABLE IF NOT EXISTS public.messenger_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messenger_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (label IN ('Important','Action Required','Order','Payment')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, label)
);
CREATE INDEX IF NOT EXISTS idx_mlb_user ON public.messenger_labels (user_id);
ALTER TABLE public.messenger_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mlb_all_self ON public.messenger_labels;
CREATE POLICY mlb_all_self ON public.messenger_labels FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4. Themes (per-user per-conversation override).
CREATE TABLE IF NOT EXISTS public.messenger_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_value TEXT NOT NULL CHECK (theme_value IN ('default','teal','indigo','rose','amber','slate')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);
ALTER TABLE public.messenger_themes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mth_all_self ON public.messenger_themes;
CREATE POLICY mth_all_self ON public.messenger_themes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 5. Scheduled messages.
CREATE TABLE IF NOT EXISTS public.messenger_scheduled (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT,
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text','image','gif','voice','file')),
  media_url TEXT,
  media_metadata JSONB DEFAULT '{}'::jsonb,
  reply_to_id UUID REFERENCES public.messenger_messages(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msc_pending ON public.messenger_scheduled (scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_msc_sender ON public.messenger_scheduled (sender_id);
ALTER TABLE public.messenger_scheduled ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS msc_select_self ON public.messenger_scheduled;
CREATE POLICY msc_select_self ON public.messenger_scheduled FOR SELECT USING (sender_id = auth.uid());
DROP POLICY IF EXISTS msc_insert_self ON public.messenger_scheduled;
CREATE POLICY msc_insert_self ON public.messenger_scheduled FOR INSERT WITH CHECK (sender_id = auth.uid());
DROP POLICY IF EXISTS msc_update_self ON public.messenger_scheduled;
CREATE POLICY msc_update_self ON public.messenger_scheduled FOR UPDATE USING (sender_id = auth.uid());
DROP POLICY IF EXISTS msc_delete_self ON public.messenger_scheduled;
CREATE POLICY msc_delete_self ON public.messenger_scheduled FOR DELETE USING (sender_id = auth.uid());

-- 6. Templates.
CREATE TABLE IF NOT EXISTS public.messenger_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  shortcut TEXT,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mtp_user ON public.messenger_templates (user_id);
ALTER TABLE public.messenger_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mtp_all_self ON public.messenger_templates;
CREATE POLICY mtp_all_self ON public.messenger_templates FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 7. Conversation labels (per-user folders).
CREATE TABLE IF NOT EXISTS public.messenger_conversation_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#00C4BC',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, conversation_id, label)
);
CREATE INDEX IF NOT EXISTS idx_mcl_user ON public.messenger_conversation_labels (user_id);
ALTER TABLE public.messenger_conversation_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mcl_all_self ON public.messenger_conversation_labels;
CREATE POLICY mcl_all_self ON public.messenger_conversation_labels FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
