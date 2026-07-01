import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';

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

  const limited = await messengerRateLimit('read', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const participant = await getParticipant(parsed.data.conversationId, user.id);
  if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const svc = await createServiceClient();
  // Escape PostgreSQL ILIKE special characters: \ % _ and [ (POSIX char-class).
  const term = parsed.data.q.replace(/[\\%_[]/g, (c) => '\\' + c);
  const { data, error: qErr } = await svc
    .from('messenger_messages')
    .select('id, conversation_id, sender_id, text, message_type, created_at')
    .eq('conversation_id', parsed.data.conversationId)
    .eq('is_deleted', false)
    .ilike('text', `%${term}%`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (qErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  const rawMessages = data ?? [];
  const messageIds = rawMessages.map((m) => m.id);
  let dismissedSet: Set<string> = new Set();
  if (messageIds.length > 0) {
    const { data: dis } = await svc
      .from('messenger_message_dismissals')
      .select('message_id')
      .eq('user_id', user.id)
      .in('message_id', messageIds);
    dismissedSet = new Set(((dis ?? []) as Array<{ message_id: string }>).map((r) => r.message_id));
  }
  const visibleMessages = rawMessages.filter((m) => !dismissedSet.has(m.id));

  return NextResponse.json({ results: visibleMessages });
}
