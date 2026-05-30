import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { MarkReadSchema } from '@/lib/messenger/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('default', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const body = await req.json().catch(() => ({}));
  const parsed = MarkReadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const participant = await getParticipant(parsed.data.conversationId, user.id);
  if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const svc = await createServiceClient();

  // Audit9: validate the message belongs to the conversation, never rewind
  // last_read_message_id to an earlier point. Service-client variant is fine
  // because we already verified participation above.
  const { data: msg } = await svc
    .from('messenger_messages')
    .select('conversation_id, created_at')
    .eq('id', parsed.data.lastReadMessageId)
    .maybeSingle();
  if (!msg || msg.conversation_id !== parsed.data.conversationId) {
    return NextResponse.json({ error: 'Message Not In Conversation' }, { status: 400 });
  }

  const { data: current } = await svc
    .from('messenger_participants')
    .select('last_read_at, last_read_message_id')
    .eq('conversation_id', parsed.data.conversationId)
    .eq('user_id', user.id)
    .maybeSingle();

  const msgTs = msg.created_at as string;
  const currentLast = current?.last_read_at as string | null | undefined;
  const newer = !currentLast || new Date(msgTs).getTime() >= new Date(currentLast).getTime();

  const updateRow: Record<string, unknown> = {
    unread_count: 0,
    last_read_at: newer ? msgTs : currentLast,
  };
  if (newer) updateRow.last_read_message_id = parsed.data.lastReadMessageId;

  const { error: updErr } = await svc
    .from('messenger_participants')
    .update(updateRow)
    .eq('conversation_id', parsed.data.conversationId)
    .eq('user_id', user.id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
