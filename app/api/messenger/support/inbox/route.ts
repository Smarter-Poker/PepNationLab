import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/messenger/support/inbox
 *
 * Admin-only. Returns every is_support=true conversation the caller
 * participates in, ordered by most recent activity. Each row includes
 *   - conversation_id, title, created_at, last_message_at
 *   - other_user: { id, full_name, username, role } (the researcher / agent)
 *   - last_message: { text, sender_id, created_at }  (or null)
 *   - unread_count: number of messages newer than the caller's last_read_at
 *                   in this conversation.
 *
 * Drives the Customer Support widget bottom-left of the messenger so the
 * admin can sweep the support queue without losing their current thread.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const svc = await createServiceClient();
  const { data: profile } = await svc
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 1. Conversations: caller is a participant + is_support flag.
  const { data: myRows, error: pErr } = await svc
    .from('messenger_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', user.id);
  if (pErr) {
    return NextResponse.json({ error: 'Failed To Load Inbox' }, { status: 500 });
  }
  const convIds = (myRows ?? []).map((r) => r.conversation_id as string);
  const lastReadByConv: Record<string, string | null> = {};
  for (const r of (myRows ?? []) as Array<{ conversation_id: string; last_read_at: string | null }>) {
    lastReadByConv[r.conversation_id] = r.last_read_at;
  }

  if (convIds.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  const { data: convs, error: cErr } = await svc
    .from('messenger_conversations')
    .select('id, title, created_at, is_support')
    .in('id', convIds)
    .eq('is_support', true);
  if (cErr) {
    return NextResponse.json({ error: 'Failed To Load Inbox' }, { status: 500 });
  }

  const supportConvIds = (convs ?? []).map((c) => c.id as string);
  if (supportConvIds.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  // 2. The OTHER participant in each support conversation (i.e. not the admin).
  const { data: allParts } = await svc
    .from('messenger_participants')
    .select('conversation_id, user_id')
    .in('conversation_id', supportConvIds);
  const otherIdByConv: Record<string, string | null> = {};
  for (const row of (allParts ?? []) as Array<{ conversation_id: string; user_id: string }>) {
    if (row.user_id === user.id) continue;
    if (!otherIdByConv[row.conversation_id]) {
      otherIdByConv[row.conversation_id] = row.user_id;
    }
  }
  const otherIds = Array.from(
    new Set(Object.values(otherIdByConv).filter((v): v is string => !!v)),
  );

  const profilesById: Record<string, { id: string; full_name: string | null; username: string | null; role: string | null }> = {};
  if (otherIds.length > 0) {
    const { data: ppl } = await svc
      .from('profiles')
      .select('id, full_name, username, role')
      .in('id', otherIds);
    for (const p of (ppl ?? []) as Array<{ id: string; full_name: string | null; username: string | null; role: string | null }>) {
      profilesById[p.id] = p;
    }
  }

  // 3. Latest message per conversation (single fetch, group client-side).
  const { data: msgs } = await svc
    .from('messenger_messages')
    .select('conversation_id, sender_id, text, message_type, created_at, is_deleted')
    .in('conversation_id', supportConvIds)
    .order('created_at', { ascending: false })
    .limit(500);
  type MsgRow = {
    conversation_id: string;
    sender_id: string;
    text: string | null;
    message_type: string | null;
    created_at: string;
    is_deleted: boolean | null;
  };
  const lastByConv: Record<string, MsgRow> = {};
  for (const m of (msgs ?? []) as MsgRow[]) {
    if (!lastByConv[m.conversation_id]) lastByConv[m.conversation_id] = m;
  }

  // 4. Unread count per conversation = messages newer than caller's last_read_at,
  //    excluding messages the caller themselves sent.
  const unreadByConv: Record<string, number> = {};
  for (const m of (msgs ?? []) as MsgRow[]) {
    const lastRead = lastReadByConv[m.conversation_id];
    if (m.sender_id === user.id) continue;
    if (lastRead && new Date(m.created_at) <= new Date(lastRead)) continue;
    unreadByConv[m.conversation_id] = (unreadByConv[m.conversation_id] ?? 0) + 1;
  }

  // 5. Assemble rows + sort by last_message_at desc (fallback: created_at).
  const rows = (convs ?? []).map((c) => {
    const otherId = otherIdByConv[c.id as string];
    const other = otherId ? profilesById[otherId] : null;
    const last = lastByConv[c.id as string] || null;
    const lastAt = last?.created_at ?? (c as { created_at?: string }).created_at ?? null;
    return {
      conversation_id: c.id as string,
      title: (c as { title?: string | null }).title ?? 'Pep Nation Support',
      created_at: (c as { created_at?: string }).created_at ?? null,
      last_message_at: lastAt,
      other_user: other
        ? {
            id: other.id,
            full_name: other.full_name,
            username: other.username,
            role: other.role,
          }
        : null,
      last_message: last
        ? {
            text: last.is_deleted ? null : last.text,
            message_type: last.message_type,
            sender_id: last.sender_id,
            sender_is_admin: last.sender_id === user.id,
            created_at: last.created_at,
          }
        : null,
      unread_count: unreadByConv[c.id as string] ?? 0,
    };
  });

  rows.sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });

  return NextResponse.json({
    conversations: rows,
    total: rows.length,
    total_unread: rows.reduce((a, r) => a + r.unread_count, 0),
  });
}
