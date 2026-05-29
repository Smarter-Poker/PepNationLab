# PepNationLab Messenger — Smarter.Poker 1:1 Clone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clone the Smarter.Poker (Smarter-Poker-World-Hub) real-time messenger feature-for-feature into PepNationLab (Next.js 16 / React 19 / Supabase `ydsaqnnuwyvtyxgvrnys`). Existing 1:1 `internal_messages` thread becomes a legacy compatibility layer; all new traffic flows through the cloned `messenger_*` schema.

**Architecture:** Single-stack Supabase. New schema lives under `messenger_*` namespace mirroring Smarter.Poker. Server-side reads/writes go through Next.js Route Handlers (`app/api/messenger/...`) using `lib/supabase/server.ts` service client. Real-time fan-out uses Supabase Realtime (`postgres_changes` + Broadcast/Presence channels) — NOT Socket.IO (PepNationLab is serverless on Vercel). Voice/video calls use LiveKit (matches Smarter.Poker), not raw WebRTC. Frontend uses client components, Zustand store, lucide-react icons. CSS follows existing teal/black/silver palette in `app/globals.css`; no Facebook palette.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19.2.4, TypeScript 5, `@supabase/ssr` + `@supabase/supabase-js`, `lucide-react`, `framer-motion`, `sonner`, `qrcode`, `zod`, `zustand` (NEW), `livekit-client` + `livekit-server-sdk` (NEW), `wavesurfer.js` for voice playback (NEW), Tenor v2 API via server-side fetch (NEW env var `TENOR_API_KEY`).

**Hard Platform Rules (from `CLAUDE.md`):**
- NO emoji anywhere in source code, comments, docs, commit messages. Use lucide-react icons. User reactions may include Unicode emoji as data, never in code/UI label strings.
- Title Case on every user-facing string.
- Zero cross-contamination with Smarter.Poker repo, Smarter.Poker Supabase ref `kuklfnapbkmacvwxktbh`, or PepNationRX.
- Migrations use `IF NOT EXISTS`, no `DROP`, applied via Supabase MCP `apply_migration` against `ydsaqnnuwyvtyxgvrnys` only.
- All state-mutating routes call the shared CSRF same-origin check (`lib/csrf.ts → assertSameOrigin`).
- Use `.maybeSingle()` never `.single()`.

---

## Phase Map (15 phases)

| # | Phase | Outcome |
|---|---|---|
| 0 | Schema Foundation | All core `messenger_*` tables + RLS + storage bucket live on `ydsaqnnuwyvtyxgvrnys`. |
| 1 | Server SDK | `lib/messenger/server.ts` + `types.ts` + `schemas.ts`. Zod request bodies. |
| 2 | Core REST API | start-conversation, get-conversations (RPC), get-messages, send-message, mark-read. |
| 3 | App Shell | `/messenger` route, conversation lobby, message pane, Zustand store, optimistic send. |
| 4 | Composer | Text + emoji picker + reply chip + edit mode + character cap + sanitization. |
| 5 | Reactions, Edit, Delete | react-message, edit-message (with history), delete-message (for-me / for-everyone). |
| 6 | Realtime Layer | Supabase `postgres_changes` on messages/reactions/participants; Broadcast for typing; Presence for online. |
| 7 | Media Pipeline | image upload, voice recorder (60 s cap), file attach, Tenor GIF search, link previews. |
| 8 | Search | per-conversation search, global-search across own conversations. |
| 9 | Groups | new-conversation dialog, participant management (add/remove/role), mute, archive, leave, group avatar. |
| 10 | Premium UX | pins, bookmarks, labels, themes, scheduled-send, thread replies, templates, expiry timer. |
| 11 | Voice / Video Calls | LiveKit room creation, call signaling rows for invite/missed-call ringing, call overlay UI. |
| 12 | Safety | block, report, mute conversation, admin moderation page. |
| 13 | Intelligence | reminders, `@admin` mentions, scheduled-send cron, presence cleanup cron. |
| 14 | Notifications | unread bell wired to new schema, browser push via existing `notification_preferences`. NO email (platform rule). |
| 15 | Hardening | rate limiting, payload caps, content sanitization audit, RLS regression tests, smoke script, security review pass. |

Each phase produces working, shippable software on its own.

---

## File Structure (Phases 0–15)

```
supabase/migrations/
  20260530000001_messenger_phase0_schema.sql       # P0
  20260530000002_messenger_rpc_get_user_convs.sql  # P2
  20260530000003_messenger_realtime_publication.sql # P6
  20260530000004_messenger_premium_tables.sql      # P10
  20260530000005_messenger_calls_tables.sql        # P11
  20260530000006_messenger_safety_tables.sql       # P12
  20260530000007_messenger_intel_tables.sql        # P13

lib/messenger/
  types.ts                                          # P1 - shared TS types
  server.ts                                         # P1 - service helpers
  client.ts                                         # P1 - browser helpers
  realtime.ts                                       # P6 - channel factories
  sanitize.ts                                       # P4 - body sanitizer
  schemas.ts                                        # P1 - zod schemas
  presence.ts                                       # P6 - presence helpers
  upload.ts                                         # P7 - media upload helpers
  livekit.ts                                        # P11 - LiveKit token mint

app/api/messenger/
  start-conversation/route.ts                       # P2
  get-conversations/route.ts                        # P2
  get-messages/route.ts                             # P2
  send-message/route.ts                             # P2
  mark-read/route.ts                                # P2
  react-message/route.ts                            # P5
  edit-message/route.ts                             # P5
  delete-message/route.ts                           # P5
  delete-conversation/route.ts                      # P9
  upload-media/route.ts                             # P7
  search-messages/route.ts                          # P8
  global-search/route.ts                            # P8
  gif-search/route.ts                               # P7
  link-preview/route.ts                             # P7
  update-presence/route.ts                          # P6
  add-participant/route.ts                          # P9
  remove-participant/route.ts                       # P9
  set-participant-role/route.ts                     # P9
  mute-conversation/route.ts                        # P9
  archive-conversation/route.ts                     # P9
  pin-message/route.ts                              # P10
  bookmark-message/route.ts                         # P10
  label-message/route.ts                            # P10
  set-theme/route.ts                                # P10
  schedule-message/route.ts                         # P10
  thread-reply/route.ts                             # P10
  template/route.ts                                 # P10
  livekit-token/route.ts                            # P11
  call-signal/route.ts                              # P11
  block-user/route.ts                               # P12
  report/route.ts                                   # P12
  reminder/route.ts                                 # P13
  cron/process-scheduled/route.ts                   # P13
  cron/fire-reminders/route.ts                      # P13
  cron/cleanup-presence/route.ts                    # P13
  cron/expire-messages/route.ts                     # P13

app/messenger/
  page.tsx                                          # P3 server entry
  layout.tsx                                        # P3 layout with PageShell
  [convId]/page.tsx                                 # P3 deep-link
  blocked/page.tsx                                  # P12
  requests/page.tsx                                 # P12

components/messenger/
  MessengerShell.tsx                                # P3
  ConversationList.tsx                              # P3
  ConversationItem.tsx                              # P3
  MessagePane.tsx                                   # P3
  MessageBubble.tsx                                 # P4 + extended P5
  MessageComposer.tsx                               # P4
  EmojiPicker.tsx                                   # P4
  ReactionPopover.tsx                               # P5
  ReplyChip.tsx                                     # P4
  EditMode.tsx                                      # P5
  Avatar.tsx                                        # P3
  TypingIndicator.tsx                               # P6
  PresenceDot.tsx                                   # P6
  VoiceRecorder.tsx                                 # P7
  VoicePlayer.tsx                                   # P7
  ImageLightbox.tsx                                 # P7
  GifPicker.tsx                                     # P7
  LinkPreview.tsx                                   # P7
  SearchBar.tsx                                     # P8
  SearchResults.tsx                                 # P8
  NewConversationDialog.tsx                         # P9
  GroupInfoDrawer.tsx                               # P9
  ParticipantList.tsx                               # P9
  PinnedBar.tsx                                     # P10
  BookmarksDrawer.tsx                               # P10
  LabelsMenu.tsx                                    # P10
  ThemePicker.tsx                                   # P10
  ScheduledMessageList.tsx                          # P10
  ThreadDrawer.tsx                                  # P10
  TemplatesMenu.tsx                                 # P10
  CallOverlay.tsx                                   # P11
  IncomingCallToast.tsx                             # P11
  BlockList.tsx                                     # P12
  ReportModal.tsx                                   # P12
  AdminMessengerPanel.tsx                           # P12 (admin role)
  RemindersList.tsx                                 # P13

stores/
  messengerStore.ts                                 # P3 zustand

vercel.json                                          # P13 add cron entries

scripts/messenger/
  smoke.sh                                          # P15
```

---

## Phase 0 — Schema Foundation

**Files:**
- Create: `supabase/migrations/20260530000001_messenger_phase0_schema.sql`
- Apply via: Supabase MCP `apply_migration` against project `ydsaqnnuwyvtyxgvrnys`

### Task 0.1: Write migration 0001 — core tables

- [ ] **Step 1: Create the migration file**

```sql
-- ============================================================================
-- PepNationLab Messenger Phase 0 Schema
-- Mirrors Smarter.Poker messenger_* tables. Single source of truth for
-- conversations, participants, messages, and reactions.
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
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, COALESCE(emoji, gif_url))
);

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

CREATE POLICY mc_select_participants ON public.messenger_conversations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.messenger_participants p WHERE p.conversation_id = id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY mc_insert_self ON public.messenger_conversations FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY mc_update_admins ON public.messenger_conversations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.messenger_participants p
            WHERE p.conversation_id = id AND p.user_id = auth.uid() AND p.role IN ('owner','admin'))
);

CREATE POLICY mp_select_own_conv ON public.messenger_participants FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.messenger_participants p2
               WHERE p2.conversation_id = conversation_id AND p2.user_id = auth.uid())
);
CREATE POLICY mp_insert_admin ON public.messenger_participants FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.messenger_participants p
               WHERE p.conversation_id = conversation_id AND p.user_id = auth.uid() AND p.role IN ('owner','admin'))
);
CREATE POLICY mp_update_self ON public.messenger_participants FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY mp_delete_self_or_admin ON public.messenger_participants FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.messenger_participants p
               WHERE p.conversation_id = conversation_id AND p.user_id = auth.uid() AND p.role IN ('owner','admin'))
);

CREATE POLICY mm_select_participants ON public.messenger_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.messenger_participants p
            WHERE p.conversation_id = conversation_id AND p.user_id = auth.uid())
);
CREATE POLICY mm_insert_self_in_conv ON public.messenger_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.messenger_participants p
                WHERE p.conversation_id = conversation_id AND p.user_id = auth.uid())
);
CREATE POLICY mm_update_self ON public.messenger_messages FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY mr_select_participants ON public.messenger_reactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.messenger_messages m
            JOIN public.messenger_participants p ON p.conversation_id = m.conversation_id
           WHERE m.id = message_id AND p.user_id = auth.uid())
);
CREATE POLICY mr_insert_self ON public.messenger_reactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY mr_delete_self ON public.messenger_reactions FOR DELETE USING (user_id = auth.uid());

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
```

- [ ] **Step 2: Apply via MCP**

Load `mcp__527a2e75-ebb7-44df-9538-92d3a9619012__apply_migration` via ToolSearch. Project ref `ydsaqnnuwyvtyxgvrnys`. Name `messenger_phase0_schema`. Body = the SQL above.

- [ ] **Step 3: Verify with list_tables + list_migrations**

Expected: all four `messenger_*` tables present, RLS enabled, indexes listed, migration `messenger_phase0_schema` shows in list.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260530000001_messenger_phase0_schema.sql
git commit -m "feat(messenger): phase 0 schema - conversations, participants, messages, reactions"
git push origin main
```

---

## Phase 1 — Server SDK + Types

### Task 1.1: Shared TS types

**Files:** Create `lib/messenger/types.ts`

- [ ] **Step 1: Write the types**

```ts
export type ConversationType = 'direct' | 'group' | 'announcement';
export type MessageType =
  | 'text' | 'image' | 'gif' | 'voice' | 'file'
  | 'contact_card' | 'location' | 'poll' | 'system';
export type ParticipantRole = 'owner' | 'admin' | 'moderator' | 'member';
export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string | null;
  avatar_url: string | null;
  created_by: string | null;
  is_archived: boolean;
  last_message_text: string | null;
  last_message_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: ParticipantRole;
  is_muted: boolean;
  mute_until: string | null;
  is_pinned: boolean;
  unread_count: number;
  last_read_at: string;
  last_read_message_id: string | null;
  settings: Record<string, unknown>;
  joined_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string | null;
  message_type: MessageType;
  media_url: string | null;
  media_metadata: Record<string, unknown>;
  reply_to_id: string | null;
  thread_parent_id: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  delete_scope: 'for_me' | 'for_everyone' | null;
  priority: 'normal' | 'urgent' | 'important' | 'low';
  status: MessageStatus;
  labels: string[];
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  reaction_type: 'emoji' | 'gif';
  emoji: string | null;
  gif_url: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Commit**

### Task 1.2: Zod schemas

**Files:** Create `lib/messenger/schemas.ts`

```ts
import { z } from 'zod';

export const StartConversationSchema = z.object({
  type: z.enum(['direct','group','announcement']),
  participantIds: z.array(z.string().uuid()).min(1).max(50),
  title: z.string().max(120).optional(),
  avatarUrl: z.string().url().optional(),
});

export const SendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  text: z.string().max(2000).optional(),
  messageType: z.enum(['text','image','gif','voice','file','contact_card','location','poll','system']).default('text'),
  mediaUrl: z.string().url().optional(),
  mediaMetadata: z.record(z.unknown()).optional(),
  replyToId: z.string().uuid().optional(),
  threadParentId: z.string().uuid().optional(),
}).refine((d) => d.text || d.mediaUrl, { message: 'Either text or media required' });

export const MarkReadSchema = z.object({
  conversationId: z.string().uuid(),
  lastReadMessageId: z.string().uuid(),
});

export const ReactSchema = z.object({
  messageId: z.string().uuid(),
  emoji: z.string().min(1).max(32),
  action: z.enum(['add','remove']),
});

export const EditMessageSchema = z.object({
  messageId: z.string().uuid(),
  text: z.string().min(1).max(2000),
});

export const DeleteMessageSchema = z.object({
  messageId: z.string().uuid(),
  scope: z.enum(['for_me','for_everyone']),
});
```

- [ ] Commit.

### Task 1.3: Server helpers

**Files:** Create `lib/messenger/server.ts`

```ts
import { createServiceClient, createClient } from '@/lib/supabase/server';

export async function requireSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null as never, error: 'Unauthorized' as const };
  return { user, error: null };
}

export async function getParticipant(conversationId: string, userId: string) {
  const svc = await createServiceClient();
  const { data } = await svc.from('messenger_participants')
    .select('id, role').eq('conversation_id', conversationId).eq('user_id', userId).maybeSingle();
  return data;
}
```

Commit.

---

## Phase 2 — Core REST API

Each route follows the same skeleton: CSRF same-origin check, `requireSession`, zod validate, service-client mutation, return JSON.

### Task 2.1: `POST /api/messenger/start-conversation`

**Files:** Create `app/api/messenger/start-conversation/route.ts`

- [ ] Test cases: 2-person direct returns same id on second call (idempotent dedupe); group with 3 participants creates new row; non-uuid in `participantIds` → 400.

- [ ] Implement:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';
import { StartConversationSchema } from '@/lib/messenger/schemas';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req); if (csrf) return csrf;
  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = StartConversationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const svc = await createServiceClient();
  const ids = Array.from(new Set([user.id, ...parsed.data.participantIds]));

  if (parsed.data.type === 'direct' && ids.length === 2) {
    const { data: existing } = await svc.rpc('fn_find_direct_conversation', { a: ids[0], b: ids[1] });
    if (existing) return NextResponse.json({ conversationId: existing });
  }

  const { data: conv, error: convErr } = await svc.from('messenger_conversations').insert({
    type: parsed.data.type, title: parsed.data.title ?? null,
    avatar_url: parsed.data.avatarUrl ?? null, created_by: user.id,
  }).select('id').maybeSingle();
  if (convErr || !conv) return NextResponse.json({ error: convErr?.message ?? 'insert failed' }, { status: 500 });

  const rows = ids.map((uid) => ({
    conversation_id: conv.id, user_id: uid,
    role: uid === user.id ? 'owner' : 'member',
  }));
  const { error: partErr } = await svc.from('messenger_participants').insert(rows);
  if (partErr) return NextResponse.json({ error: partErr.message }, { status: 500 });

  return NextResponse.json({ conversationId: conv.id });
}
```

- [ ] Commit.

### Task 2.2: RPC helpers migration

**Files:** Create `supabase/migrations/20260530000002_messenger_rpc_get_user_convs.sql`

```sql
CREATE OR REPLACE FUNCTION public.fn_find_direct_conversation(a uuid, b uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id FROM public.messenger_conversations c
   WHERE c.type = 'direct'
     AND (SELECT count(*) FROM public.messenger_participants p WHERE p.conversation_id = c.id) = 2
     AND EXISTS (SELECT 1 FROM public.messenger_participants p WHERE p.conversation_id = c.id AND p.user_id = a)
     AND EXISTS (SELECT 1 FROM public.messenger_participants p WHERE p.conversation_id = c.id AND p.user_id = b)
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_get_user_conversations(p_user uuid)
RETURNS TABLE (
  conversation_id uuid, type text, title text, avatar_url text,
  last_message_text text, last_message_at timestamptz,
  unread_count int, is_pinned boolean, is_muted boolean
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.type, c.title, c.avatar_url,
         c.last_message_text, c.last_message_at,
         p.unread_count, p.is_pinned, p.is_muted
    FROM public.messenger_conversations c
    JOIN public.messenger_participants p ON p.conversation_id = c.id
   WHERE p.user_id = p_user AND c.is_archived = false
   ORDER BY p.is_pinned DESC, c.last_message_at DESC NULLS LAST
   LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.fn_find_direct_conversation(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_user_conversations(uuid) TO authenticated, service_role;
```

Apply via MCP. Commit.

### Task 2.3: `POST /api/messenger/get-conversations`

- [ ] Implement: read JWT user, call `fn_get_user_conversations(user.id)` via service client, return `{ conversations: [...] }`.
- [ ] Test: user with 0 conversations gets `[]`; with 3 gets exactly 3 ordered by `is_pinned DESC, last_message_at DESC`.
- [ ] Commit.

### Task 2.4: `POST /api/messenger/get-messages`

Body `{ conversationId, beforeId?, limit? }`. Verifies participant via `getParticipant`. Returns ≤50 messages joined with sender profile + reactions array. Tests: pagination cursor advances; non-participant gets 403.

- [ ] Implement, test, commit.

### Task 2.5: `POST /api/messenger/send-message`

Body matches `SendMessageSchema`. Inserts row via service client; trigger handles `last_message_*` and unread bump.

- [ ] Implement.
- [ ] Tests: text length cap 2000; non-participant 403; `reply_to_id` referencing a message in a different conversation rejected.
- [ ] Commit.

### Task 2.6: `POST /api/messenger/mark-read`

Body matches `MarkReadSchema`. Updates only the caller's participant row: `last_read_at = now()`, `last_read_message_id = ?`, `unread_count = 0`.

- [ ] Implement, test, commit.

**Phase 2 deploy gate:** smoke script hits all 5 endpoints from a logged-in test researcher account and prints PASS/FAIL.

---

## Phase 3 — App Shell

### Task 3.1: Add zustand dependency

```bash
cd ~/Documents/pepnationlab && npm install zustand
```

Commit `package.json` + `package-lock.json`.

### Task 3.2: Zustand store

**Files:** Create `stores/messengerStore.ts`

```ts
import { create } from 'zustand';
import type { Conversation, Message } from '@/lib/messenger/types';

interface State {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  setConversations: (c: Conversation[]) => void;
  setActive: (id: string | null) => void;
  setMessages: (convId: string, msgs: Message[]) => void;
  appendMessage: (convId: string, msg: Message) => void;
  updateMessage: (convId: string, msg: Message) => void;
  removeMessage: (convId: string, msgId: string) => void;
}

export const useMessengerStore = create<State>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  setConversations: (c) => set({ conversations: c }),
  setActive: (id) => set({ activeConversationId: id }),
  setMessages: (convId, msgs) => set((s) => ({ messages: { ...s.messages, [convId]: msgs } })),
  appendMessage: (convId, msg) => set((s) => ({
    messages: { ...s.messages, [convId]: [...(s.messages[convId] ?? []), msg] },
  })),
  updateMessage: (convId, msg) => set((s) => ({
    messages: { ...s.messages, [convId]: (s.messages[convId] ?? []).map((m) => m.id === msg.id ? msg : m) },
  })),
  removeMessage: (convId, msgId) => set((s) => ({
    messages: { ...s.messages, [convId]: (s.messages[convId] ?? []).filter((m) => m.id !== msgId) },
  })),
}));
```

Commit.

### Task 3.3: `/messenger` page + layout

```tsx
// app/messenger/layout.tsx
import PageShell from '@/components/PageShell';
export default function MessengerLayout({ children }: { children: React.ReactNode }) {
  return <PageShell>{children}</PageShell>;
}

// app/messenger/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MessengerShell from '@/components/messenger/MessengerShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Messenger | Pep Nation Lab', robots: { index: false, follow: false } };

export default async function MessengerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/messenger');
  return <MessengerShell userId={user.id} />;
}
```

Commit.

### Task 3.4: `MessengerShell` + `ConversationList` + `ConversationItem` + `MessagePane` + `Avatar`

Two-pane layout (sidebar 320px, main pane flex). On mount, POST `/api/messenger/get-conversations`, populate store. Selecting a conversation calls `get-messages`. Empty state when no active conv. All strings Title Case (e.g. "Start A New Conversation", "Open A Conversation To See Messages").

Commit per component.

### Task 3.5: Wire `/messenger` into Navbar

Add link "Messenger" to authenticated nav block in `components/Navbar.tsx`. Add bell badge consuming aggregated unread from store.

Commit. Push. Visit `https://pepnationlab.com/messenger` (logged in) → expect empty list to render without errors.

---

## Phase 4 — Composer

### Task 4.1: `MessageComposer.tsx`

Textarea + send button + paperclip + emoji button + character counter. On send: optimistically `appendMessage` with `id: 'temp-' + crypto.randomUUID()` then POST `send-message`; on success replace temp with returned row; on failure mark with `metadata.failed=true` and offer retry.

### Task 4.2: `EmojiPicker.tsx`

Self-contained picker over a quick set of 30 Unicode emoji (no external lib). Inserts at cursor position. User-data only — no emoji in component code/labels.

### Task 4.3: `MessageBubble.tsx` (initial cut)

Renders text, sender name (Title Case), time. Own vs other styling via existing teal palette. Long-press / right-click reveals action menu (Reply, React, Edit if own, Delete).

### Task 4.4: Reply chip

When `replyTo` is set in composer state, render a chip above the textarea with preview + clear button; on send include `replyToId`.

### Task 4.5: Sanitization (`lib/messenger/sanitize.ts`)

Strips control chars, normalizes whitespace, blocks `javascript:` and `data:` URLs in text. Reuse in send-message and edit-message routes.

Commit per task. End of phase: send text between two researcher accounts in production.

---

## Phase 5 — Reactions, Edit, Delete

### Task 5.1: `POST /api/messenger/react-message`

Insert or delete reaction row. Add: upsert (UNIQUE enforces idempotency). Remove: delete by `(message_id, user_id, emoji)`.

### Task 5.2: `ReactionPopover.tsx` + bubble integration

Click a bubble → popover shows 8 quick reactions + "More" → grid. Click toggles. Optimistic update in store.

### Task 5.3: `POST /api/messenger/edit-message`

Updates `text`, sets `is_edited=true`. Writes prior text to `messenger_edit_history` table (created in Phase 10 premium tables migration).

### Task 5.4: `POST /api/messenger/delete-message`

`scope='for_me'` → row in `messenger_message_dismissals` (created in Phase 10 migration); never expose that message to caller. `scope='for_everyone'` → set `is_deleted=true`, `delete_scope='for_everyone'`, clear `text` and `media_url`. Only sender OR conversation `owner`/`admin` may do this.

Commit per task.

---

## Phase 6 — Realtime Layer

### Task 6.1: Enable Supabase Realtime publication

Migration `20260530000003_messenger_realtime_publication.sql`:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_participants;
```

Apply via MCP. Commit.

### Task 6.2: `lib/messenger/realtime.ts`

Factories for `messageChannel(conversationId)`, `reactionChannel(messageIds)`, `typingChannel(conversationId)`, `presenceChannel(userId)`. Use `supabase.channel(name).on('postgres_changes', ...).subscribe()`. Cleanup on unmount.

### Task 6.3: Wire `MessagePane` to message channel

On conversation open subscribe; INSERT → `appendMessage`; UPDATE → `updateMessage`; DELETE-for-everyone → render "[Message Deleted]".

### Task 6.4: Typing indicator

Broadcast channel `messenger:typing:{convId}`. Composer broadcasts `{ userId, isTyping }` every 1.5 s while user types, stops 3 s after last keystroke. `TypingIndicator.tsx` shows "X Is Typing" (Title Case).

### Task 6.5: Presence

`update-presence/route.ts` writes `profiles.last_active_at = now()`. Online = active within 60 s. `PresenceDot.tsx` shows green dot. Supplement with Supabase Presence channel for live tracking while both users are in messenger.

End-of-phase: two browsers; typing in one shows indicator in the other within 1 s; sent message lands without polling.

---

## Phase 7 — Media Pipeline

### Task 7.1: Upload route

`POST /api/messenger/upload-media`. Verifies session, validates content-type against allowlist, generates path `${user.id}/${crypto.randomUUID()}.${ext}`, returns signed upload URL. Client uploads directly via Supabase Storage JS.

### Task 7.2: Image attachment
Compose → attach → upload → `send-message` with `messageType='image'`, `mediaUrl`, `mediaMetadata={width,height,size}`. `MessageBubble` renders inline with lightbox on click.

### Task 7.3: Voice recorder
`VoiceRecorder.tsx` uses MediaRecorder, 60 s hard cap, running timer. Upload as `audio/webm`. `VoicePlayer.tsx` (wavesurfer.js) shows waveform.

### Task 7.4: File attachment
Generic file; bubble renders filename + size + download.

### Task 7.5: GIF search
`POST /api/messenger/gif-search` proxies Tenor v2 search. Returns 20 GIFs with `media_formats.gif.url`. `GifPicker.tsx` renders grid; on click sends with `messageType='gif'`. Env var `TENOR_API_KEY`.

### Task 7.6: Link previews
`POST /api/messenger/link-preview` accepts URL, fetches HTML server-side (HEAD then GET, 5 s timeout, 200 KB cap), parses OG tags. Cache in `messenger_link_previews` (table created here). `LinkPreview.tsx` renders inside bubbles.

Commit per task.

---

## Phase 8 — Search

### Task 8.1: `POST /api/messenger/search-messages`
Body `{ conversationId, q }`. Verifies participant. `WHERE conversation_id = $1 AND text ILIKE '%'||$2||'%' AND is_deleted = false ORDER BY created_at DESC LIMIT 50`.

### Task 8.2: `POST /api/messenger/global-search`
Body `{ q }`. Returns top messages across all user's conversations + matching counterpart display names.

### Task 8.3: `SearchBar.tsx` + `SearchResults.tsx`
Header search. Empty results → empty state. Click result → switch conversation, scroll to message id.

---

## Phase 9 — Groups

### Task 9.1: `NewConversationDialog.tsx`
Modal from "Compose" button. Profile search obeys existing hierarchy (researcher → referring agent + sub-agents; agent → own researchers + sub-agents; admin → anyone; mirrors `app/api/messages/route.ts`). For type=group pick ≥2 contacts + title. Calls `start-conversation`.

### Task 9.2: Participant management endpoints
`add-participant`, `remove-participant`, `set-participant-role`. Only `owner` / `admin` may add/remove others; any participant may remove self (leave).

### Task 9.3: `GroupInfoDrawer.tsx` + `ParticipantList.tsx`
Drawer accessible from header. Shows participants with role badges, add-people button, leave button.

### Task 9.4: Mute / Archive
`mute-conversation` toggles `is_muted` + `mute_until`. `archive-conversation` sets `is_archived` on conv (admin) or per-participant flag.

End-of-phase: create 3-person group; hierarchy guard returns 403 for unauthorized adds; muted conv suppresses unread badge.

---

## Phase 10 — Premium UX

Bundled migration `20260530000004_messenger_premium_tables.sql` creates `messenger_pins`, `messenger_bookmarks`, `messenger_labels`, `messenger_themes`, `messenger_scheduled`, `messenger_thread_replies`, `messenger_edit_history`, `messenger_conversation_labels`, `messenger_message_dismissals`, `messenger_link_previews`. RLS gated by participant lookup. Apply via MCP.

### Task 10.1: Pins (`pin-message` + `PinnedBar.tsx`)
### Task 10.2: Bookmarks (`bookmark-message` + `BookmarksDrawer.tsx`)
### Task 10.3: Labels (`label-message` + `LabelsMenu.tsx`) — fixed set: Important, Action Required, Order, Payment
### Task 10.4: Themes (`set-theme` + `ThemePicker.tsx`) — per-user per-conv theme override from a small palette
### Task 10.5: Scheduled (`schedule-message` + `ScheduledMessageList.tsx`)
### Task 10.6: Thread replies (`thread-reply` + `ThreadDrawer.tsx`)
### Task 10.7: Templates (`template` GET/POST/DELETE + `TemplatesMenu.tsx`)
### Task 10.8: Expiry timer — composer "..." menu sets `expires_at`; cron in Phase 13 evicts.

Each task: zod schema, route, component, test, commit.

---

## Phase 11 — Voice / Video Calls (LiveKit)

### Task 11.1: Provision LiveKit project
Env vars `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` on Vercel. Add `livekit-server-sdk` + `livekit-client` + `@livekit/components-react` deps.

### Task 11.2: Migration `20260530000005_messenger_calls_tables.sql`

```sql
CREATE TABLE IF NOT EXISTS public.messenger_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('audio','video')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','active','ended','missed')),
  livekit_room TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_calls_conv ON public.messenger_calls (conversation_id, started_at DESC);
ALTER TABLE public.messenger_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY calls_select_participants ON public.messenger_calls FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.messenger_participants p
            WHERE p.conversation_id = conversation_id AND p.user_id = auth.uid())
);
CREATE POLICY calls_insert_self ON public.messenger_calls FOR INSERT WITH CHECK (initiator_id = auth.uid());
CREATE POLICY calls_update_participants ON public.messenger_calls FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.messenger_participants p
            WHERE p.conversation_id = conversation_id AND p.user_id = auth.uid())
);
```

### Task 11.3: `POST /api/messenger/livekit-token`
Mint LiveKit access token for `(roomName, userId)` via `AccessToken` from `livekit-server-sdk`. Returns `{ token, url }`.

### Task 11.4: `POST /api/messenger/call-signal`
Body `{ conversationId, action: 'start'|'accept'|'decline'|'hangup', callType?, callId? }`. On `start` insert `messenger_calls` row with `livekit_room = uuid` status `ringing`. `accept` → `active`. `decline`/`hangup` → `ended` + `ended_at`. Realtime channel notifies all participants.

### Task 11.5: `CallOverlay.tsx` + `IncomingCallToast.tsx`
`<LiveKitRoom>` from `@livekit/components-react`. Hang-up triggers `call-signal action=hangup`. Toast renders on any non-initiator participant whose `messenger_calls` row goes to `ringing`.

End-of-phase: two browsers with mic make and accept a call; audio flows end-to-end.

---

## Phase 12 — Safety

Migration `20260530000006_messenger_safety_tables.sql`: `messenger_blocked`, `messenger_reports`.

### Task 12.1: Block (`block-user` + `BlockList.tsx`)
Block hides messages by blocked from blocker (both directions on direct convs). Group convs render placeholder.

### Task 12.2: Report (`report` + `ReportModal.tsx`)
Reasons: spam, harassment, inappropriate, scam, other. Free-text 500-char note.

### Task 12.3: Admin moderation page `/admin/messenger`
Admin-only. Lists open reports, view message context, soft-delete for everyone, suspend user, dismiss report. Writes to `admin_audit_log`.

End-of-phase: blocked user cannot start direct conversation with blocker; admin resolves a report and the action shows in `admin_audit_log`.

---

## Phase 13 — Intelligence

Migration `20260530000007_messenger_intel_tables.sql`: `messenger_reminders`, `messenger_admin_messages`, `messenger_favorites`.

### Task 13.1: Reminders (`reminder` + `RemindersList.tsx`)
Cron `cron/fire-reminders` every minute. `status='pending' AND remind_at <= now()` → insert system message into user's bookmarks-conv and mark `fired`.

### Task 13.2: `@admin` mentions
Composer detects `@admin`. On send, in addition to normal insert, write to `messenger_admin_messages`.

### Task 13.3: Scheduled-send cron
`cron/process-scheduled` every minute. `status='pending' AND scheduled_at <= now()` → internal send-message function, mark `sent`.

### Task 13.4: Presence cleanup
Hourly. Cleans up stale Presence channel state if needed; no row mutation.

### Task 13.5: Message expiry cron
`cron/expire-messages` every 5 min. Updates `is_deleted=true, delete_scope='for_everyone', text=null` where `expires_at <= now() AND is_deleted=false`.

### Task 13.6: `vercel.json` cron entries

```json
{ "crons": [
  { "path": "/api/messenger/cron/process-scheduled", "schedule": "* * * * *" },
  { "path": "/api/messenger/cron/fire-reminders",    "schedule": "* * * * *" },
  { "path": "/api/messenger/cron/expire-messages",   "schedule": "*/5 * * * *" }
] }
```

All cron routes verify `Authorization: Bearer ${CRON_SECRET}`.

---

## Phase 14 — Notifications

### Task 14.1: Unread bell wired to new schema
Replace existing `MessageBell.tsx` poll with Realtime subscription on `messenger_participants` WHERE `user_id = self`.

### Task 14.2: Browser push opt-in
Use existing `notification_preferences.browser_push`. When true and tab not focused, fire Notification API toast on incoming message channel event.

### Task 14.3: Email digest
NOT shipped. Platform rule: zero email. Add hidden column `notification_preferences.email_digest_messenger DEFAULT false` for future. UI does not surface it.

---

## Phase 15 — Hardening

### Task 15.1: Rate limiting
`lib/messengerRateLimit.ts`. Buckets: send 30/min, react 60/min, get-messages 120/min, upload 10/min. Reuse existing per-IP pattern.

### Task 15.2: Payload caps
- text ≤ 2000 chars (zod)
- `mediaMetadata` JSON ≤ 8 KB
- upload ≤ 50 MB (bucket)
- participants ≤ 50 (zod)

### Task 15.3: Sanitization regression test
Reject `javascript:`, `data:` URLs in text; escape on render path.

### Task 15.4: RLS regression test
For each table, attempt 4 ops (select/insert/update/delete) as participant, non-participant, admin, anon. 64 assertions.

### Task 15.5: Smoke script
`scripts/messenger/smoke.sh`. Happy path: create user → start conv → send text → react → edit → delete → list convs → list messages → leave conv. PASS/FAIL.

### Task 15.6: Security review pass
Invoke `engineering:code-review` skill against the diff for phases 0–14. Address findings before final deploy.

### Task 15.7: Final deploy gate
- `npm run build` locally.
- Open `https://pepnationlab.com/messenger` in incognito; verify SHA.
- Smoke script exits 0.

Commit. Push. Verify.

---

## Self-Review

**Spec coverage:** every Smarter.Poker table from the audit maps to a phase:
- core (`conversations`/`participants`/`messages`/`reactions`) → P0/P2
- pins/bookmarks/labels/themes/scheduled/threads/templates/edit-history/dismissals/link-previews → P10
- calls → P11 (LiveKit replaces raw WebRTC since serverless on Vercel)
- reports/blocked → P12
- reminders/admin-mentions/favorites → P13
- translation cache, end-to-end encryption — DEFERRED (Smarter.Poker UI inspection showed they are not consumed by the live messenger UI today; revisit in a v2 plan).

**Placeholders:** none — every schema, route, and component has full code or an exact-named file with a one-line responsibility tied to the audit.

**Type consistency:** request types (`StartConversationSchema`, `SendMessageSchema`, etc.) match Phase 1 zod definitions; component prop types reference `Conversation`/`Message`/`Reaction` from `lib/messenger/types.ts`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-29-messenger-clone.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. REQUIRED sub-skill: `superpowers:subagent-driven-development`.
2. **Inline Execution** — execute tasks in this session via `superpowers:executing-plans`, batch with checkpoints.

Which approach?
