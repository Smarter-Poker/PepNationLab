import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { GetMessagesSchema } from '@/lib/messenger/schemas';
import { signMessengerMediaUrls } from '@/lib/messenger/signMedia';
import { maskAdminIdentity } from '@/lib/messenger/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { Database } from '@/types/database.types';
type MessageRow = Database['public']['Tables']['messenger_messages']['Row'];

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

  // Viewer role drives admin-identity masking: non-admin viewers must see admin
  // senders as the generic "PepNation Support" identity (display only).
  const { data: viewerProfile } = await svc
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const viewerIsAdmin = (viewerProfile as { role?: string } | null)?.role === 'admin';

  let query = svc
    .from('messenger_messages')
    .select('*')
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
  let senders: Array<{ id: string; full_name: string | null; username: string | null; avatar_url: string | null; role: string | null }> = [];
  if (senderIds.length > 0) {
    const { data: p } = await svc
      .from('profiles')
      .select('id, full_name, username, avatar_url, role')
      .in('id', senderIds);
    senders = p ?? [];
  }
  const senderMap = new Map(senders.map((s) => [s.id, s]));
  // Mask admin senders as "PepNation Support" for non-admin viewers. `role` is
  // used only for the mask decision and is never emitted (preserving the audit9
  // contract that non-admins don't learn other participants' roles).
  const messagesWithSenders = visibleMessages.map((m) => {
    const raw = senderMap.get(m.sender_id as string) ?? null;
    const masked = maskAdminIdentity(raw, viewerIsAdmin);
    const sender = masked
      ? {
          id: masked.id,
          full_name: masked.full_name,
          username: !viewerIsAdmin && raw?.role === 'admin' ? null : masked.username,
          avatar_url: masked.avatar_url,
        }
      : null;
    return { ...m, sender };
  });

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
