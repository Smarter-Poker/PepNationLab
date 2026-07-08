import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { GetMessagesSchema } from '@/lib/messenger/schemas';
import { signMessengerMediaUrls } from '@/lib/messenger/signMedia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string | null;
  message_type: string;
  media_url: string | null;
  media_metadata: unknown;
  reply_to_id: string | null;
  thread_parent_id: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  delete_scope: string | null;
  priority: string | null;
  status: string | null;
  labels: unknown;
  expires_at: string | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('read', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const body = await req.json().catch(() => ({}));
  const parsed = GetMessagesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const participant = await getParticipant(parsed.data.conversationId, user.id);
  if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const limit = parsed.data.limit ?? 50;
  const svc = await createServiceClient();

  let query = svc
    .from('messenger_messages')
    .select(
      'id, conversation_id, sender_id, text, message_type, media_url, media_metadata, reply_to_id, thread_parent_id, is_edited, is_deleted, delete_scope, priority, status, labels, expires_at, metadata, created_at, updated_at'
    )
    .eq('conversation_id', parsed.data.conversationId)
    .is('thread_parent_id', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (parsed.data.beforeId) {
    const { data: cursor } = await svc
      .from('messenger_messages')
      .select('created_at')
      .eq('id', parsed.data.beforeId)
      .maybeSingle();
    if (cursor?.created_at) {
      query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${parsed.data.beforeId})`);
    }
  }

  const { data, error: qErr } = await query;
  if (qErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });

  const messages = (data ?? []) as MessageRow[];

  // Audit9: scrub content from messages tombstoned via for_everyone delete
  // so the server is the source of truth (defense in depth alongside the UI).
  for (const m of messages) {
    if (m.is_deleted && m.delete_scope === 'for_everyone') {
      m.text = null;
      m.media_url = null;
      m.media_metadata = {};
    }
  }

  const messageIds = messages.map((m) => m.id);

  // Honor `for_me` dismissals. A user-issued dismissal hides the message from
  // the dismisser's view only.
  let dismissedSet: Set<string> = new Set();
  if (messageIds.length > 0) {
    const { data: dis } = await svc
      .from('messenger_message_dismissals')
      .select('message_id')
      .eq('user_id', user.id)
      .in('message_id', messageIds);
    dismissedSet = new Set(((dis ?? []) as Array<{ message_id: string }>).map((r) => r.message_id));
  }
  const visibleMessages = messages.filter((m) => !dismissedSet.has(m.id));
  const visibleIds = visibleMessages.map((m) => m.id);

  // Bulk-load sender profiles. The sender_id FK targets auth.users, not
  // profiles, so PostgREST cannot embed profiles directly -- we fetch by id.
  // Audit9: drop counterparty role from the response so non-admin viewers
  // don't learn the role of other group/announcement participants.
  const senderIds = Array.from(new Set(visibleMessages.map((m) => m.sender_id)));
  let senders: Array<{ id: string; full_name: string | null; username: string | null; avatar_url: string | null }> = [];
  if (senderIds.length > 0) {
    const { data: p } = await svc
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', senderIds);
    senders = p ?? [];
  }
  const senderMap = new Map(senders.map((s) => [s.id, s]));
  const messagesWithSenders = visibleMessages.map((m) => ({
    ...m,
    sender: senderMap.get(m.sender_id) ?? null,
  }));

  let reactions: Array<{ message_id: string; user_id: string; emoji: string | null; gif_url: string | null; reaction_type: string }> = [];
  if (visibleIds.length > 0) {
    const { data: r } = await svc
      .from('messenger_reactions')
      .select('message_id, user_id, emoji, gif_url, reaction_type')
      .in('message_id', visibleIds);
    reactions = r ?? [];
  }

  // Re-sign private-bucket media into short-lived signed URLs at read time.
  const signedMessages = await signMessengerMediaUrls(messagesWithSenders);

  const res = NextResponse.json({ messages: signedMessages.reverse(), reactions });
  res.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return res;
}
