import { z } from "zod";
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireAdmin } from '@/lib/admin-auth';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


const POSTBodySchema = z.any();

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const limited = await messengerRateLimit('admin', gate.userId);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  
  const __rawBody = await req.json().catch(() => ({}));
  const __bodyParse = POSTBodySchema.safeParse(__rawBody);
  if (!__bodyParse.success) {
    return NextResponse.json({ error: "Invalid Request Body", details: __bodyParse.error.issues }, { status: 400 });
  }
  const body = __bodyParse.data;

  const statusFilter = typeof body?.status === 'string' && ['open', 'resolved', 'dismissed'].includes(body.status)
    ? (body.status as 'open' | 'resolved' | 'dismissed')
    : null;
  // Audit10: paginate via { before: ISO created_at cursor, limit: 1..100 }.
  // Without this, status='all' callers could lose newer open reports behind
  // 200 newer dismissed ones.
  const before = typeof body?.before === 'string' && Number.isFinite(Date.parse(body.before))
    ? new Date(Date.parse(body.before)).toISOString()
    : null;
  const rawLimit = typeof body?.limit === 'number' ? body.limit : 50;
  const limit = Math.min(Math.max(1, Math.floor(rawLimit)), 100);

  const svc = await createServiceClient();

  let q = svc
    .from('messenger_reports')
    .select('id, reporter_id, message_id, conversation_id, reason, note, status, resolved_by, resolved_at, resolution_note, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (statusFilter) q = q.eq('status', statusFilter);
  if (before) q = q.lt('created_at', before);

  const { data: reports, error: qErr } = await q;
  if (qErr) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  const rows = reports ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ reports: [], nextBefore: null });
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

  // The cursor returned to the client is the OLDEST created_at in this page,
  // i.e. the boundary they should pass back as `before` for the next call.
  const lastCreatedAt = rows.reduce<string | null>((acc, r) => {
    const t = r.created_at as string | null;
    if (!t) return acc;
    if (!acc) return t;
    return Date.parse(t) < Date.parse(acc) ? t : acc;
  }, null);

  return NextResponse.json({
    reports: enriched,
    nextBefore: rows.length === limit ? lastCreatedAt : null,
  });
}
