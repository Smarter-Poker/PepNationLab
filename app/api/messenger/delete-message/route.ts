import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { DeleteMessageSchema } from '@/lib/messenger/schemas';
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
  const parsed = DeleteMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const svc = createAdminClient();
  const { data: msg } = await svc
    .from('messenger_messages')
    .select('id, conversation_id, sender_id, is_deleted')
    .eq('id', parsed.data.messageId)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: 'Message Not Found' }, { status: 404 });

  if (parsed.data.scope === 'for_me') {
    const participant = await getParticipant(msg.conversation_id, user.id);
    if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: existing } = await svc
      .from('messenger_message_dismissals')
      .select('message_id')
      .eq('message_id', parsed.data.messageId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) return NextResponse.json({ ok: true });

    const { error: insErr } = await svc.from('messenger_message_dismissals').insert({
      message_id: parsed.data.messageId,
      user_id: user.id,
    });
    if (insErr) {
      const code = (insErr as { code?: string }).code;
      if (code === '23505') return NextResponse.json({ ok: true });
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (msg.is_deleted) return NextResponse.json({ ok: true });

  // Audit9: for_everyone delete now requires the caller to be a CURRENT
  // participant of the conversation. Former participants (who left or were
  // removed) cannot retroactively tombstone messages even if they sent them.
  const participant = await getParticipant(msg.conversation_id, user.id);
  if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const allowed =
    participant.role === 'owner' ||
    participant.role === 'admin';
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: updated, error: updErr } = await svc
    .from('messenger_messages')
    .update({
      is_deleted: true,
      delete_scope: 'for_everyone',
      text: null,
      media_url: null,
      media_metadata: {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.messageId)
    .select('*')
    .single();
  if (updErr || !updated) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  await sendBroadcast({
    topic: `chat:${msg.conversation_id}`,
    event: 'delete_message',
    payload: { messageId: parsed.data.messageId, message: updated },
  });

  return NextResponse.json({ ok: true });
}
