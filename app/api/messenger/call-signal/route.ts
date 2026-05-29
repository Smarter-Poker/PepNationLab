import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant, isBlocked } from '@/lib/messenger/server';
import { StartCallSchema, CallSignalSchema } from '@/lib/messenger/schemas';
import { z } from 'zod';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }).merge(StartCallSchema),
  z.object({ action: z.literal('accept'), callId: z.string().uuid() }),
  z.object({ action: z.literal('decline'), callId: z.string().uuid() }),
  z.object({ action: z.literal('hangup'), callId: z.string().uuid() }),
]);

interface CallRow {
  id: string;
  conversation_id: string;
  initiator_id: string;
  call_type: 'audio' | 'video';
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined';
  livekit_room: string;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
}

function callsConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_URL &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET,
  );
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  if (!callsConfigured()) {
    return NextResponse.json({ error: 'Calls Not Configured' }, { status: 503 });
  }

  const svc = await createServiceClient();

  if (parsed.data.action === 'start') {
    const callerPart = await getParticipant(parsed.data.conversationId, user.id);
    if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

    // Audit3 fix: in direct conversations, refuse to ring the counterparty if
    // either side has blocked the other. Group conversations rely on the
    // existing add-participant block gate for membership, so calls within a
    // group are allowed (blocked users won't be members in the first place).
    const { data: convCheck } = await svc
      .from('messenger_conversations')
      .select('id, type')
      .eq('id', parsed.data.conversationId)
      .maybeSingle();
    if (convCheck && convCheck.type === 'direct') {
      const { data: others } = await svc
        .from('messenger_participants')
        .select('user_id')
        .eq('conversation_id', parsed.data.conversationId)
        .neq('user_id', user.id);
      const otherId = ((others ?? [])[0] as { user_id: string } | undefined)?.user_id;
      if (otherId) {
        const blockedByCaller = await isBlocked(user.id, otherId);
        const blockedByOther = await isBlocked(otherId, user.id);
        if (blockedByCaller || blockedByOther) {
          return NextResponse.json({ error: 'User Blocked' }, { status: 403 });
        }
      }
    }

    // Audit2 fix: prevent two simultaneous starts from forking the conversation
    // into two LiveKit rooms with no way to reconcile. If a ringing or active
    // call already exists for this conversation, return it so the client can
    // join instead of starting a fresh room.
    const { data: existingCall } = await svc
      .from('messenger_calls')
      .select('*')
      .eq('conversation_id', parsed.data.conversationId)
      .in('status', ['ringing', 'active'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingCall) {
      return NextResponse.json({ call: existingCall, alreadyActive: true });
    }

    const livekitRoom = `call-${crypto.randomUUID()}`;
    const { data: inserted, error: insErr } = await svc
      .from('messenger_calls')
      .insert({
        conversation_id: parsed.data.conversationId,
        initiator_id: user.id,
        call_type: parsed.data.callType,
        status: 'ringing',
        livekit_room: livekitRoom,
      })
      .select('*')
      .maybeSingle();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    return NextResponse.json({ call: inserted });
  }

  // accept / decline / hangup all need the existing call row.
  const callId = parsed.data.callId;
  const { data: call } = await svc
    .from('messenger_calls')
    .select('*')
    .eq('id', callId)
    .maybeSingle();
  if (!call) return NextResponse.json({ error: 'Call Not Found' }, { status: 404 });

  const callerPart = await getParticipant((call as CallRow).conversation_id, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

  if (parsed.data.action === 'accept') {
    if ((call as CallRow).initiator_id === user.id) {
      return NextResponse.json({ error: 'Initiator Cannot Accept Own Call' }, { status: 400 });
    }
    if ((call as CallRow).status !== 'ringing') {
      return NextResponse.json({ error: 'Call Not Ringing' }, { status: 400 });
    }
    const { data: updated, error: upErr } = await svc
      .from('messenger_calls')
      .update({ status: 'active', answered_at: new Date().toISOString() })
      .eq('id', callId)
      .select('*')
      .maybeSingle();
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    return NextResponse.json({ call: updated });
  }

  if (parsed.data.action === 'decline') {
    if ((call as CallRow).status !== 'ringing') {
      return NextResponse.json({ error: 'Call Not Ringing' }, { status: 400 });
    }
    const { data: updated, error: upErr } = await svc
      .from('messenger_calls')
      .update({ status: 'declined', ended_at: new Date().toISOString() })
      .eq('id', callId)
      .select('*')
      .maybeSingle();
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    return NextResponse.json({ call: updated });
  }

  // hangup
  if ((call as CallRow).status === 'ended' || (call as CallRow).status === 'declined' || (call as CallRow).status === 'missed') {
    return NextResponse.json({ call });
  }
  const { data: updated, error: upErr } = await svc
    .from('messenger_calls')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', callId)
    .select('*')
    .maybeSingle();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ call: updated });
}
