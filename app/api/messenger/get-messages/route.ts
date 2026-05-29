import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { GetMessagesSchema } from '@/lib/messenger/schemas';

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
    .order('created_at', { ascending: false })
    .limit(limit);

  if (parsed.data.beforeId) {
    const { data: cursor } = await svc
      .from('messenger_messages')
      .select('created_at')
      .eq('id', parsed.data.beforeId)
      .maybeSingle();
    if (cursor?.created_at) {
      query = query.lt('created_at', cursor.created_at);
    }
  }

  const { data, error: qErr } = await query;
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  const messages = (data ?? []) as MessageRow[];
  const messageIds = messages.map((m) => m.id);

  // Bulk-load sender profiles. The sender_id FK targets auth.users, not
  // profiles, so PostgREST cannot embed profiles directly — we fetch by id.
  const senderIds = Array.from(new Set(messages.map((m) => m.sender_id)));
  let senders: Array<{ id: string; full_name: string | null; username: string | null; role: string | null }> = [];
  if (senderIds.length > 0) {
    const { data: p } = await svc
      .from('profiles')
      .select('id, full_name, username, role')
      .in('id', senderIds);
    senders = p ?? [];
  }
  const senderMap = new Map(senders.map((s) => [s.id, s]));
  const messagesWithSenders = messages.map((m) => ({
    ...m,
    sender: senderMap.get(m.sender_id) ?? null,
  }));

  let reactions: Array<{ message_id: string; user_id: string; emoji: string | null; gif_url: string | null }> = [];
  if (messageIds.length > 0) {
    const { data: r } = await svc
      .from('messenger_reactions')
      .select('message_id, user_id, emoji, gif_url')
      .in('message_id', messageIds);
    reactions = r ?? [];
  }

  return NextResponse.json({ messages: messagesWithSenders.reverse(), reactions });
}
