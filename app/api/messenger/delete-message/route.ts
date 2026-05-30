import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { DeleteMessageSchema } from '@/lib/messenger/schemas';

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

  const svc = await createServiceClient();
  const { data: msg } = await svc
    .from('messenger_messages')
    .select('id, conversation_id, sender_id, is_deleted')
    .eq('id', parsed.data.messageId)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: 'Message Not Found' }, { status: 404 });

  // for_me delete is purely a per-user dismissal -- the row is hidden from
  // the caller's view but stays visible to other participants. Caller must
  // still be a participant in the conversation to dismiss.
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
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (msg.is_deleted) return NextResponse.json({ ok: true });

  // for_everyone: must be the sender, or an owner/admin of the conversation.
  const participant = await getParticipant(msg.conversation_id, user.id);
  const allowed =
    msg.sender_id === user.id ||
    participant?.role === 'owner' ||
    participant?.role === 'admin';
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error: updErr } = await svc
    .from('messenger_messages')
    .update({
      is_deleted: true,
      delete_scope: 'for_everyone',
      text: null,
      media_url: null,
      media_metadata: {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.messageId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
