import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CallRow {
  id: string;
  conversation_id: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  // audit15 fix-8: lock down what was previously a wide-open anonymous
  // broadcast endpoint. See commit message for the rationale.

  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('default', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get('targetId');
  if (!targetId || !UUID_RE.test(targetId)) {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad Request' }, { status: 400 });

  // The client posts `{ type, event, payload: <CallSignalRow> }`. We need the
  // call id + conversation id to verify the caller is authorized to broadcast.
  const payload = (body.payload ?? body) as { id?: string; conversation_id?: string };
  const callId = payload?.id;
  const conversationId = payload?.conversation_id;
  if (!callId || !UUID_RE.test(callId) || !conversationId || !UUID_RE.test(conversationId)) {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }

  const svc = await createServiceClient();

  // Confirm the call exists and that the claimed conversation_id matches the
  // row in the database. Refuses to broadcast for a call the caller is trying
  // to spoof.
  const { data: call } = await svc
    .from('messenger_calls')
    .select('id, conversation_id')
    .eq('id', callId)
    .maybeSingle();
  if (!call || (call as CallRow).conversation_id !== conversationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // The caller must be a participant of the conversation. Non-participants
  // cannot terminate calls they're not on.
  const callerPart = await getParticipant(conversationId, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // The target must also be a participant. Cannot redirect a call_ended
  // broadcast to an unrelated user.
  const targetPart = await getParticipant(conversationId, targetId);
  if (!targetPart) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const channel = svc.channel(`call-signal:${targetId}`);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Channel subscription timeout')), 5000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve();
        } else if (status === 'CHANNEL_ERROR') {
          clearTimeout(timeout);
          reject(new Error('Channel error'));
        }
      });
    });

    await channel.send({
      type: 'broadcast',
      event: 'call_ended',
      payload,
    });

    await svc.removeChannel(channel);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[UNLOAD BROADCAST] Failed to broadcast server-side:', err);
    return NextResponse.json({ error: 'Failed To Broadcast' }, { status: 500 });
  }
}
