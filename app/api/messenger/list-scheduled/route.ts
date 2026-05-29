import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ScheduledRow {
  id: string;
  conversation_id: string;
  text: string | null;
  message_type: string;
  media_url: string | null;
  reply_to_id: string | null;
  scheduled_at: string;
  status: string;
  created_at: string;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const svc = await createServiceClient();

  const { data, error: qErr } = await svc
    .from('messenger_scheduled')
    .select('id, conversation_id, text, message_type, media_url, reply_to_id, scheduled_at, status, created_at')
    .eq('sender_id', user.id)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })
    .limit(200);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  const list = (data ?? []) as ScheduledRow[];
  if (list.length === 0) return NextResponse.json({ scheduled: [] });

  const convIds = Array.from(new Set(list.map((r) => r.conversation_id)));
  const { data: convs } = await svc
    .from('messenger_conversations')
    .select('id, type, title')
    .in('id', convIds);
  const byId = new Map<string, { type: string; title: string | null }>();
  (convs ?? []).forEach((c) => byId.set(c.id, { type: c.type, title: c.title }));

  const scheduled = list.map((r) => ({
    ...r,
    conversation_type: byId.get(r.conversation_id)?.type ?? null,
    conversation_title: byId.get(r.conversation_id)?.title ?? null,
  }));

  return NextResponse.json({ scheduled });
}
