import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const statusFilter = typeof body?.status === 'string' && ['open', 'resolved', 'dismissed'].includes(body.status)
    ? (body.status as 'open' | 'resolved' | 'dismissed')
    : null;

  const svc = await createServiceClient();

  let q = svc
    .from('messenger_reports')
    .select('id, reporter_id, message_id, conversation_id, reason, note, status, resolved_by, resolved_at, resolution_note, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (statusFilter) q = q.eq('status', statusFilter);

  const { data: reports, error: qErr } = await q;
  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  const rows = reports ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ reports: [] });
  }

  const reporterIds = Array.from(new Set(rows.map((r) => r.reporter_id as string).filter(Boolean)));
  const messageIds = Array.from(new Set(rows.map((r) => r.message_id as string).filter(Boolean)));
  const conversationIds = Array.from(new Set(rows.map((r) => r.conversation_id as string).filter(Boolean)));

  const [reportersRes, messagesRes, conversationsRes] = await Promise.all([
    reporterIds.length > 0
      ? svc.from('profiles').select('id, full_name, username').in('id', reporterIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; username: string | null }> }),
    messageIds.length > 0
      ? svc
          .from('messenger_messages')
          .select('id, text, message_type, sender_id, created_at, is_deleted, delete_scope')
          .in('id', messageIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    conversationIds.length > 0
      ? svc.from('messenger_conversations').select('id, type, title').in('id', conversationIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const reporters = new Map((reportersRes.data ?? []).map((p) => [p.id as string, p]));
  const messages = new Map(((messagesRes.data ?? []) as Array<{ id: string }>).map((m) => [m.id, m]));
  const senderIds = Array.from(
    new Set(
      ((messagesRes.data ?? []) as Array<{ sender_id?: string | null }>)
        .map((m) => m.sender_id ?? null)
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const sendersRes = senderIds.length > 0
    ? await svc.from('profiles').select('id, full_name, username').in('id', senderIds)
    : { data: [] as Array<{ id: string; full_name: string | null; username: string | null }> };
  const senders = new Map((sendersRes.data ?? []).map((p) => [p.id as string, p]));
  const conversations = new Map(((conversationsRes.data ?? []) as Array<{ id: string }>).map((c) => [c.id, c]));

  // Sort: open first (regardless of status filter), then by created_at DESC.
  const ordered = [...rows].sort((a, b) => {
    const sa = a.status === 'open' ? 0 : 1;
    const sb = b.status === 'open' ? 0 : 1;
    if (sa !== sb) return sa - sb;
    const ta = a.created_at ? Date.parse(a.created_at as string) : 0;
    const tb = b.created_at ? Date.parse(b.created_at as string) : 0;
    return tb - ta;
  });

  const enriched = ordered.map((r) => {
    const rep = reporters.get(r.reporter_id as string) ?? null;
    const msg = messages.get(r.message_id as string) as
      | { id: string; text: string | null; message_type: string; sender_id: string | null; created_at: string; is_deleted: boolean; delete_scope: string | null }
      | undefined;
    const sender = msg?.sender_id ? senders.get(msg.sender_id) ?? null : null;
    const conv = conversations.get(r.conversation_id as string) as
      | { id: string; type: string; title: string | null }
      | undefined;
    return {
      ...r,
      reporter: rep ? { id: rep.id, full_name: rep.full_name, username: rep.username } : null,
      message: msg
        ? {
            id: msg.id,
            text: msg.text,
            message_type: msg.message_type,
            sender_id: msg.sender_id,
            created_at: msg.created_at,
            is_deleted: msg.is_deleted,
            delete_scope: msg.delete_scope,
            sender: sender ? { id: sender.id, full_name: sender.full_name, username: sender.username } : null,
          }
        : null,
      conversation: conv ? { id: conv.id, type: conv.type, title: conv.title } : null,
    };
  });

  return NextResponse.json({ reports: enriched });
}
