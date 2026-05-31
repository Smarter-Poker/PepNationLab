import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant, isBlockedEither } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { StartCallSchema } from '@/lib/messenger/schemas';
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

  const limited = await messengerRateLimit('default', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

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

    // Audit10: block-pair gate now covers direct AND group/announcement
    // conversations. Previous audit3 fix only blocked direct calls; group
    // calls between users with a one-sided block could still proceed.
    const { data: others } = await svc
      .from('messenger_participants')
      .select('user_id')
      .eq('conversation_id', parsed.data.conversationId)
      .neq('user_id', user.id);
    for (const row of (others ?? []) as Array<{ user_id: string }>) {
      if (await isBlockedEither(user.id, row.user_id)) {
        return NextResponse.json({ error: 'User Blocked' }, { status: 403 });
      }
    }

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
    if (insErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
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
      .eq('status', 'ringing')
      .select('*')
      .maybeSingle();
    if (upErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    if (!updated) {
      const { data: current } = await svc
        .from('messenger_calls')
        .select('*')
        .eq('id', callId)
        .maybeSingle();
      return NextResponse.json({ call: current, alreadyAccepted: true });
    }
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
      .eq('status', 'ringing')
      .select('*')
      .maybeSingle();
    if (upErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    if (!updated) {
      const { data: current } = await svc
        .from('messenger_calls')
        .select('*')
        .eq('id', callId)
        .maybeSingle();
      return NextResponse.json({ call: current, alreadyResolved: true });
    }
    
    // Insert Missed Call system message
    const typeStr = updated.call_type === 'video' ? 'Video' : 'Voice';
    await svc.from('messenger_messages').insert({
      conversation_id: updated.conversation_id,
      sender_id: updated.initiator_id,
      message_type: 'system',
      text: `📞 Missed ${typeStr} Call`,
      status: 'sent',
      metadata: { call_id: updated.id, status: 'declined' }
    });

    return NextResponse.json({ call: updated });
  }

  // hangup
  // Audit10: only the initiator OR a participant who has actually joined an
  // active call may hangup. Other participants (e.g. a group member who never
  // accepted) cannot kill a call they did not engage with. The check below
  // accepts the initiator unconditionally, plus any participant during the
  // 'active' phase. A 'ringing' call may only be hangup'd by the initiator.
  const callerIsInitiator = (call as CallRow).initiator_id === user.id;
  const callIsActive = (call as CallRow).status === 'active';
  const callerCanHangup = callerIsInitiator || callIsActive;
  if (!callerCanHangup) {
    return NextResponse.json({ error: 'Only The Initiator Can End A Ringing Call' }, { status: 403 });
  }

  if ((call as CallRow).status === 'ended' || (call as CallRow).status === 'declined' || (call as CallRow).status === 'missed') {
    return NextResponse.json({ call });
  }
  const { data: updated, error: upErr } = await svc
    .from('messenger_calls')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', callId)
    .select('*')
    .maybeSingle();
  if (upErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  
  if (updated) {
    const typeStr = updated.call_type === 'video' ? 'Video' : 'Voice';
    
    if (callIsActive && updated.answered_at) {
       const start = new Date(updated.answered_at).getTime();
       const end = new Date(updated.ended_at!).getTime();
       const diffSecs = Math.max(0, Math.floor((end - start) / 1000));
       const mins = Math.floor(diffSecs / 60);
       const secs = diffSecs % 60;
       const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

       await svc.from('messenger_messages').insert({
         conversation_id: updated.conversation_id,
         sender_id: updated.initiator_id,
         message_type: 'system',
         text: `📞 ${typeStr} Call Ended (${durationStr})`,
         status: 'sent',
         metadata: { call_id: updated.id, status: 'ended', duration: diffSecs }
       });
    } else {
       await svc.from('messenger_messages').insert({
         conversation_id: updated.conversation_id,
         sender_id: updated.initiator_id,
         message_type: 'system',
         text: `📞 Missed ${typeStr} Call`,
         status: 'sent',
         metadata: { call_id: updated.id, status: 'ended_before_answer' }
       });
    }
  }

  return NextResponse.json({ call: updated });
}

