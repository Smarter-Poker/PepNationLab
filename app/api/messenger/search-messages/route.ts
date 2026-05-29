import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Schema = z.object({
  conversationId: z.string().uuid(),
  q: z.string().min(1).max(120),
});

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const participant = await getParticipant(parsed.data.conversationId, user.id);
  if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const svc = await createServiceClient();
  const term = parsed.data.q.replace(/[\\%_]/g, (c) => '\\' + c);
  const { data, error: qErr } = await svc
    .from('messenger_messages')
    .select('id, conversation_id, sender_id, text, message_type, created_at')
    .eq('conversation_id', parsed.data.conversationId)
    .eq('is_deleted', false)
    .ilike('text', `%${term}%`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  return NextResponse.json({ results: data ?? [] });
}
