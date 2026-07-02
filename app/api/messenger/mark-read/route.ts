import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { MarkReadSchema } from '@/lib/messenger/schemas';
import { sendBroadcast } from '@/lib/messenger/broadcast';

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

  // Audit11: explicit p_caller_id so the SECURITY DEFINER RPC works when
  // called via the service-role client.
  const svc = await createServiceClient();
  const { data: prefs } = await svc
    .from('notification_preferences')
    .select('send_read_receipts')
    .eq('user_id', user.id)
    .maybeSingle();

  const updateReadId = prefs?.send_read_receipts !== false;

  const { error: rpcErr } = await svc.rpc('fn_messenger_mark_read', {
    p_caller_id: user.id,
    p_conv_id: parsed.data.conversationId,
    p_last_msg_id: parsed.data.lastReadMessageId,
  });
  if (rpcErr) {
    const msg = rpcErr.message ?? '';
    if (msg.includes('message_not_in_conversation')) {
      return NextResponse.json({ error: 'Message Not In Conversation' }, { status: 400 });
    }
    if (msg.includes('not_a_participant')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (msg.includes('unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: msg || 'Mark Read Failed' }, { status: 500 });
  }

  // Audit15: If the user disabled read receipts, wipe the last_read_message_id 
  // so the sender doesn't see it, but we preserve last_read_at and unread_count=0.
  if (!updateReadId) {
    await svc.from('messenger_participants')
      .update({ last_read_message_id: null })
      .eq('conversation_id', parsed.data.conversationId)
      .eq('user_id', user.id);
  }

  // Also clear any 'new_message' bell notifications for THIS conversation
  await svc.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('type', 'new_message')
    .like('url', `%conv=${parsed.data.conversationId}%`)
    .is('read_at', null);

  const { data: updatedParticipant } = await svc
    .from('messenger_participants')
    .select('*')
    .eq('conversation_id', parsed.data.conversationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (updatedParticipant) {
    await Promise.all([
      sendBroadcast({
        topic: `chat:${parsed.data.conversationId}`,
        event: 'participant_updated',
        payload: { participant: updatedParticipant },
      }),
      sendBroadcast({
        topic: `user_unread:${user.id}`,
        event: 'participant_updated',
        payload: { participant: updatedParticipant },
      })
    ]);
  }

  return NextResponse.json({ ok: true });
}
