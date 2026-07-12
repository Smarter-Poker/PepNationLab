import { z } from "zod";
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireAdmin } from '@/lib/admin-auth';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { ListAdminMentionsSchema } from '@/lib/messenger/schemas';

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

  const parsed = ListAdminMentionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid Body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const svc = await createServiceClient();

  let q = svc
    .from('messenger_admin_messages')
    .select(
      'id, message_id, conversation_id, sender_id, message_text, status, resolved_by, resolved_at, resolution_note, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (parsed.data.status) q = q.eq('status', parsed.data.status);

  const { data: mentions, error: qErr } = await q;
  if (qErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  const rows = mentions ?? [];
  if (rows.length === 0) return NextResponse.json({ mentions: [] });

  const senderIds = Array.from(
    new Set(rows.map((r) => r.sender_id as string | null).filter((v): v is string => Boolean(v))),
  );
  const messageIds = Array.from(
    new Set(rows.map((r) => r.message_id as string).filter(Boolean)),
  );
  const conversationIds = Array.from(
    new Set(rows.map((r) => r.conversation_id as string).filter(Boolean)),
  );

  const [sendersRes, messagesRes, conversationsRes] = await Promise.all([
    senderIds.length > 0
      ? svc.from('profiles').select('id, full_name, username').in('id', senderIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; username: string | null }> }),
    messageIds.length > 0
      ? svc
          .from('messenger_messages')
          .select('id, text, message_type, created_at, is_deleted, delete_scope')
          .in('id', messageIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    conversationIds.length > 0
      ? svc.from('messenger_conversations').select('id, type, title').in('id', conversationIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const senders = new Map((sendersRes.data ?? []).map((p) => [p.id as string, p]));
  const messages = new Map(((messagesRes.data ?? []) as Array<{ id: string }>).map((m) => [m.id, m]));
  const conversations = new Map(
    ((conversationsRes.data ?? []) as Array<{ id: string }>).map((c) => [c.id, c]),
  );

  // Sort: unread first, then by created_at DESC.
  const ordered = [...rows].sort((a, b) => {
    const sa = a.status === 'unread' ? 0 : 1;
    const sb = b.status === 'unread' ? 0 : 1;
    if (sa !== sb) return sa - sb;
    const ta = a.created_at ? Date.parse(a.created_at as string) : 0;
    const tb = b.created_at ? Date.parse(b.created_at as string) : 0;
    return tb - ta;
  });

  const enriched = ordered.map((r) => {
    const sender = r.sender_id ? senders.get(r.sender_id as string) ?? null : null;
    const msg = messages.get(r.message_id as string) as
      | { id: string; text: string | null; message_type: string; created_at: string; is_deleted: boolean; delete_scope: string | null }
      | undefined;
    const conv = conversations.get(r.conversation_id as string) as
      | { id: string; type: string; title: string | null }
      | undefined;
    return {
      ...r,
      sender: sender ? { id: sender.id, full_name: sender.full_name, username: sender.username } : null,
      message: msg
        ? {
            id: msg.id,
            text: msg.text,
            message_type: msg.message_type,
            created_at: msg.created_at,
            is_deleted: msg.is_deleted,
            delete_scope: msg.delete_scope,
          }
        : null,
      conversation: conv ? { id: conv.id, type: conv.type, title: conv.title } : null,
    };
  });

  return NextResponse.json({ mentions: enriched });
}
