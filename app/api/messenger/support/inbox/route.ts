import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/messenger/support/inbox
 * Admin-only. Returns every is_support conversation the caller participates in,
 * enriched with v2 metadata: status, snooze, SLA, topic, order_id, notes_count.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = await createServiceClient();
  const { data: profile } = await svc
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: myRows, error: pErr } = await svc
    .from('messenger_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', user.id);
  if (pErr) return NextResponse.json({ error: 'Failed To Load Inbox' }, { status: 500 });

  const convIds = (myRows ?? []).map((r) => r.conversation_id as string);
  if (convIds.length === 0) return NextResponse.json({ conversations: [] });

  const lastReadByConv: Record<string, string | null> = {};
  for (const r of (myRows ?? []) as Array<{ conversation_id: string; last_read_at: string | null }>) {
    lastReadByConv[r.conversation_id] = r.last_read_at;
  }

  const { data: convs, error: cErr } = await svc
    .from('messenger_conversations')
    .select('id, title, created_at, is_support, support_status, support_topic, support_order_id, support_snoozed_until, support_last_researcher_message_at, support_first_response_at')
    .in('id', convIds)
    .eq('is_support', true);
  if (cErr) return NextResponse.json({ error: 'Failed To Load Inbox' }, { status: 500 });

  const supportConvIds = (convs ?? []).map((c) => c.id as string);
  if (supportConvIds.length === 0) return NextResponse.json({ conversations: [] });

  // Other participant per thread
  const { data: allParts } = await svc
    .from('messenger_participants')
    .select('conversation_id, user_id')
    .in('conversation_id', supportConvIds);
  const otherIdByConv: Record<string, string | null> = {};
  for (const row of (allParts ?? []) as Array<{ conversation_id: string; user_id: string }>) {
    if (row.user_id === user.id) continue;
    if (!otherIdByConv[row.conversation_id]) otherIdByConv[row.conversation_id] = row.user_id;
  }
  const otherIds = Array.from(new Set(Object.values(otherIdByConv).filter((v): v is string => !!v)));

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

  // Recent messages (one query, group client-side)
  const { data: msgs } = await svc
    .from('messenger_messages')
    .select('id, conversation_id, sender_id, text, message_type, created_at, is_deleted')
    .in('conversation_id', supportConvIds)
    .order('created_at', { ascending: false })
    .limit(500);

  type MsgRow = {
    id: string;
    conversation_id: string; sender_id: string;
    text: string | null; message_type: string | null;
    created_at: string; is_deleted: boolean | null;
  };
  const lastByConv: Record<string, MsgRow> = {};
  for (const m of (msgs ?? []) as MsgRow[]) {
    if (!lastByConv[m.conversation_id]) lastByConv[m.conversation_id] = m;
  }

  // Unread counts (caller's vantage)
  const unreadByConv: Record<string, number> = {};
  for (const m of (msgs ?? []) as MsgRow[]) {
    if (m.sender_id === user.id) continue;
    const lr = lastReadByConv[m.conversation_id];
    if (lr && new Date(m.created_at) <= new Date(lr)) continue;
    unreadByConv[m.conversation_id] = (unreadByConv[m.conversation_id] ?? 0) + 1;
  }

  // Internal-note counts per conversation
  const notesByConv: Record<string, number> = {};
  const { data: noteRows } = await svc
    .from('messenger_support_internal_notes')
    .select('conversation_id')
    .in('conversation_id', supportConvIds);
  for (const n of (noteRows ?? []) as Array<{ conversation_id: string }>) {
    notesByConv[n.conversation_id] = (notesByConv[n.conversation_id] ?? 0) + 1;
  }

  const now = Date.now();
  const rows = (convs ?? []).map((c) => {
    const cid = c.id as string;
    const otherId = otherIdByConv[cid];
    const other = otherId ? profilesById[otherId] : null;
    const last = lastByConv[cid] || null;
    const lastAt = last?.created_at ?? (c as { created_at?: string }).created_at ?? null;
    const lastResearcherTs = (c as { support_last_researcher_message_at?: string | null }).support_last_researcher_message_at;
    const waitingSec = lastResearcherTs ? Math.max(0, Math.floor((now - new Date(lastResearcherTs).getTime()) / 1000)) : null;
    const snoozedUntil = (c as { support_snoozed_until?: string | null }).support_snoozed_until ?? null;
    const isSnoozed = !!(snoozedUntil && new Date(snoozedUntil).getTime() > now);
    return {
      conversation_id: cid,
      title: (c as { title?: string | null }).title ?? 'Pep Nation Support',
      created_at: (c as { created_at?: string }).created_at ?? null,
      last_message_at: lastAt,
      support_status: (c as { support_status?: string | null }).support_status ?? 'open',
      support_topic: (c as { support_topic?: string | null }).support_topic ?? null,
      support_order_id: (c as { support_order_id?: string | null }).support_order_id ?? null,
      support_snoozed_until: snoozedUntil,
      is_snoozed: isSnoozed,
      support_first_response_at: (c as { support_first_response_at?: string | null }).support_first_response_at ?? null,
      support_last_researcher_message_at: lastResearcherTs ?? null,
      sla_waiting_seconds: waitingSec,
      internal_notes_count: notesByConv[cid] ?? 0,
      other_user: other
        ? { id: other.id, full_name: other.full_name, username: other.username, role: other.role }
        : null,
      last_message: last
        ? {
            id: last.id,
            text: last.is_deleted ? null : last.text,
            message_type: last.message_type,
            sender_id: last.sender_id,
            sender_is_admin: last.sender_id === user.id,
            created_at: last.created_at,
          }
        : null,
      unread_count: unreadByConv[cid] ?? 0,
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
    open_count: rows.filter((r) => r.support_status === 'open' || r.support_status === 'in_progress' || r.support_status === 'waiting_on_researcher').length,
    resolved_count: rows.filter((r) => r.support_status === 'resolved').length,
  });
}
