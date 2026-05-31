import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant, isBlockedEither, broadcastCallSignalServer } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { StartCallSchema } from '@/lib/messenger/schemas';
import { recordCallTelemetry } from '@/lib/messenger/callTelemetry';
import { enqueueCallRingPush, sendCallRingPushNow } from '@/lib/messenger/callPush';
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

function ipFrom(req: NextRequest): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
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
  const ip = ipFrom(req);
  const ua = req.headers.get('user-agent');

  if (parsed.data.action === 'start') {
    const callerPart = await getParticipant(parsed.data.conversationId, user.id);
    if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

    // Audit10: block-pair gate
    const { data: others } = await svc
      .from('messenger_participants')
      .select('user_id')
      .eq('conversation_id', parsed.data.conversationId)
      .neq('user_id', user.id);
    const otherList = (others ?? []) as Array<{ user_id: string }>;
    for (const row of otherList) {
      if (await isBlockedEither(user.id, row.user_id)) {
        return NextResponse.json({ error: 'User Blocked' }, { status: 403 });
      }
    }

    // audit15 fix-21 (B2): per-pair call_start rate limit. Evaluated per target
    // so a caller can still call multiple distinct users at the platform
    // default — only the per-pair burst is throttled. First target that trips
    // the limiter blocks the start.
    for (const row of otherList) {
      const pairKey = `${user.id}:${row.user_id}`;
      const pairLimited = await messengerRateLimit('call_start', pairKey);
      if (!pairLimited.allowed) return messengerRateLimitResponse(pairLimited);
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
    if (insErr || !inserted) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

    // audit15 fix-21 (B6): telemetry — log the start with participant count.
    void recordCallTelemetry('messenger_call.start', user.id, {
      call_id: (inserted as CallRow).id,
      conversation_id: (inserted as CallRow).conversation_id,
      initiator_id: (inserted as CallRow).initiator_id,
      call_type: (inserted as CallRow).call_type,
      participant_count: otherList.length + 1,
    }, ip, ua);

    // Broadcast the incoming call signal to each target
    if (otherList.length > 0) {
      for (const p of otherList) {
        void broadcastCallSignalServer(p.user_id, 'incoming_call', inserted);
      }

      // audit15 fix-21 (B3): web push fanout. Resolve caller's name once,
      // then both enqueue durable outbox rows AND fire inline so devices
      // with subscriptions wake up immediately. The cron handles late
      // delivery for offline devices.
      const { data: callerProfile } = await svc
        .from('profiles')
        .select('full_name, username, email')
        .eq('id', user.id)
        .maybeSingle();
      const callerName =
        (callerProfile?.full_name && String(callerProfile.full_name).trim()) ||
        (callerProfile?.username && String(callerProfile.username).trim()) ||
        (callerProfile?.email && String(callerProfile.email).split('@')[0]) ||
        'Someone';
      const targetIds = otherList.map((p) => p.user_id);
      const pushInput = {
        callId: (inserted as CallRow).id,
        callType: (inserted as CallRow).call_type,
        targetUserIds: targetIds,
        callerName,
        conversationId: (inserted as CallRow).conversation_id,
      };
      void enqueueCallRingPush(pushInput);
      void sendCallRingPushNow(pushInput);
    }

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

    // audit15 fix-21 (B6): telemetry — ring_ms = answered_at - started_at.
    const startedAt = new Date((updated as CallRow).started_at).getTime();
    const answeredAt = new Date((updated as CallRow).answered_at!).getTime();
    void recordCallTelemetry('messenger_call.accept', user.id, {
      call_id: (updated as CallRow).id,
      conversation_id: (updated as CallRow).conversation_id,
      initiator_id: (updated as CallRow).initiator_id,
      call_type: (updated as CallRow).call_type,
      ring_ms: Math.max(0, answeredAt - startedAt),
    }, ip, ua);

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
    const typeStr = (updated as CallRow).call_type === 'video' ? 'Video' : 'Voice';
    await svc.from('messenger_messages').insert({
      conversation_id: (updated as CallRow).conversation_id,
      sender_id: (updated as CallRow).initiator_id,
      message_type: 'system',
      text: `Missed ${typeStr} Call`,
      status: 'sent',
      metadata: { call_id: (updated as CallRow).id, status: 'declined' }
    });

    void recordCallTelemetry('messenger_call.decline', user.id, {
      call_id: (updated as CallRow).id,
      conversation_id: (updated as CallRow).conversation_id,
      initiator_id: (updated as CallRow).initiator_id,
      call_type: (updated as CallRow).call_type,
      reason: 'declined',
    }, ip, ua);

    return NextResponse.json({ call: updated });
  }

  // hangup
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
    const u = updated as CallRow;
    const typeStr = u.call_type === 'video' ? 'Video' : 'Voice';

    if (callIsActive && u.answered_at) {
       const start = new Date(u.answered_at).getTime();
       const end = new Date(u.ended_at!).getTime();
       const diffSecs = Math.max(0, Math.floor((end - start) / 1000));
       const mins = Math.floor(diffSecs / 60);
       const secs = diffSecs % 60;
       const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

       await svc.from('messenger_messages').insert({
         conversation_id: u.conversation_id,
         sender_id: u.initiator_id,
         message_type: 'system',
         text: `${typeStr} Call Ended (${durationStr})`,
         status: 'sent',
         metadata: { call_id: u.id, status: 'ended', duration: diffSecs }
       });

       void recordCallTelemetry('messenger_call.hangup', user.id, {
         call_id: u.id,
         conversation_id: u.conversation_id,
         initiator_id: u.initiator_id,
         call_type: u.call_type,
         talk_ms: end - start,
         reason: 'ended',
       }, ip, ua);
    } else {
       await svc.from('messenger_messages').insert({
         conversation_id: u.conversation_id,
         sender_id: u.initiator_id,
         message_type: 'system',
         text: `Missed ${typeStr} Call`,
         status: 'sent',
         metadata: { call_id: u.id, status: 'ended_before_answer' }
       });

       void recordCallTelemetry('messenger_call.hangup', user.id, {
         call_id: u.id,
         conversation_id: u.conversation_id,
         initiator_id: u.initiator_id,
         call_type: u.call_type,
         reason: 'ended_before_answer',
       }, ip, ua);
    }
  }

  return NextResponse.json({ call: updated });
}
