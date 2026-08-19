import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant, isBlockedEither, broadcastCallSignalServer } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { getClientIp } from '@/lib/rate-limit';
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

  const svc = createAdminClient();
  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent');

  if (parsed.data.action === 'start') {
    const callerPart = await getParticipant(parsed.data.conversationId, user.id);
    if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

    // Group-call support: the client needs to know whether this call belongs
    // to a group conversation (join-in-progress semantics, keep ringing after
    // first accept) or a direct one (classic 1:1). type/title are not columns
    // on messenger_calls, so they ride along on the broadcast payload and the
    // API response instead.
    const { data: convRow } = await svc
      .from('messenger_conversations')
      .select('type, title')
      .eq('id', parsed.data.conversationId)
      .maybeSingle();
    const convType = ((convRow as { type?: string } | null)?.type ?? 'direct') as 'direct' | 'group' | 'announcement';
    const convTitle = (convRow as { title?: string | null } | null)?.title ?? null;

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
    // Is that existing row a LIVE call, or wreckage?
    //
    // Reusing it unconditionally was a trap. If a call ends badly — everyone's
    // network drops at once, or the last person's tab is killed while
    // backgrounded — nobody is left to write status='ended', and the row sits
    // there 'active'. The stale-call sweep only collects rows four hours old,
    // so for four hours every single attempt to call in this conversation
    // short-circuited to THIS branch: no new row, no ring, no push, everyone
    // dropped silently into a LiveKit room that had been empty for hours. One
    // bad call bricked the conversation for the rest of the evening — exactly
    // when you would be trying hardest to get back on.
    //
    // A genuinely live call is one that is still ringing, or that was answered
    // recently enough to plausibly still be going. Anything older with no
    // participants is wreckage: end it and start fresh.
    const REJOINABLE_ACTIVE_MS = 90 * 60 * 1000; // 90 minutes
    const existingRow = existingCall as CallRow | null;
    const answeredMs = existingRow?.answered_at ? Date.parse(existingRow.answered_at) : NaN;
    const looksLive =
      existingRow?.status === 'ringing' ||
      (existingRow?.status === 'active' &&
        Number.isFinite(answeredMs) &&
        Date.now() - answeredMs < REJOINABLE_ACTIVE_MS);

    if (existingRow && looksLive) {
      // A call really is up in this conversation. Returning the row (enriched)
      // lets the caller's client join it — for a group this is exactly the
      // "tap the camera icon to join the ongoing call" path.
      return NextResponse.json({
        call: { ...existingRow, conversation_type: convType, conversation_title: convTitle },
        alreadyActive: true,
      });
    }

    if (existingRow) {
      // Wreckage. Close it (compare-and-swap so a real participant hanging up
      // at the same moment still wins) and fall through to a fresh call.
      try {
        await svc
          .from('messenger_calls')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', existingRow.id)
          .in('status', ['ringing', 'active']);
        await recordCallTelemetry('messenger_call.stale_active_sweep', user.id, {
          call_id: existingRow.id,
          conversation_id: existingRow.conversation_id,
          initiator_id: existingRow.initiator_id,
          call_type: existingRow.call_type,
          reason: 'stranded_before_new_call',
        }, ip, ua);
      } catch (err) {
        // Never block a new call on tidying up an old one.
        console.warn('[call-signal] could not sweep stranded call', existingRow.id, err);
      }
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
    if (insErr || !inserted) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });

    await recordCallTelemetry('messenger_call.start', user.id, {
      call_id: (inserted as CallRow).id,
      conversation_id: (inserted as CallRow).conversation_id,
      initiator_id: (inserted as CallRow).initiator_id,
      call_type: (inserted as CallRow).call_type,
      participant_count: otherList.length + 1,
    }, ip, ua);

    if (otherList.length > 0) {
      // fix-44: include avatar_url so the receiver's IncomingCallScreen can
      // render the caller's profile photo (Daniel's avatar instead of the
      // "DB" initials placeholder) without any authenticated API lookups.
      const { data: callerProfile } = await svc
        .from('profiles')
        .select('full_name, username, email, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      const callerName =
        (callerProfile?.full_name && String(callerProfile.full_name).trim()) ||
        (callerProfile?.username && String(callerProfile.username).trim()) ||
        (callerProfile?.email && String(callerProfile.email).split('@')[0]) ||
        'Someone';
      const callerUsername = callerProfile?.username ?? null;
      const callerAvatar = callerProfile?.avatar_url ?? null;

      const enrichedPayload = {
        ...inserted,
        caller_name: callerName,
        caller_username: callerUsername,
        caller_avatar: callerAvatar,
        conversation_type: convType,
        conversation_title: convTitle,
      };

      for (const p of otherList) {
        await broadcastCallSignalServer(p.user_id, 'incoming_call', enrichedPayload);
      }

      const targetIds = otherList.map((p) => p.user_id);
      const pushInput = {
        callId: (inserted as CallRow).id,
        callType: (inserted as CallRow).call_type,
        targetUserIds: targetIds,
        callerName,
        conversationId: (inserted as CallRow).conversation_id,
      };
      await enqueueCallRingPush(pushInput);
      await sendCallRingPushNow(pushInput);

      // Durable in-app notification so an incoming call ALWAYS lands in the
      // recipient's notification bell -- even when the app is closed, realtime
      // is not connected, or web-push is unavailable. Before this, a call left
      // no trace anywhere off-app. Service client bypasses RLS. Best-effort:
      // a notify failure must never break call setup.
      try {
        const callTypeLabel = (inserted as CallRow).call_type === 'video' ? 'Video' : 'Voice';
        await svc.from('notifications').insert(
          otherList.map((p) => ({
            user_id: p.user_id,
            type: 'incoming_call',
            title: `Incoming ${callTypeLabel} Call`,
            body: `${callerName} Is Calling You`,
            // Deep-link with ?call=<id> so tapping the bell entry while the
            // call is still ringing auto-accepts it (GlobalCallListener reads
            // the param) - the same behavior the web-push tap already has.
            url: `/messenger?call=${(inserted as CallRow).id}`,
          }))
        );
      } catch { /* in-app notification is best-effort */ }
    }

    return NextResponse.json({
      call: { ...inserted, conversation_type: convType, conversation_title: convTitle },
    });
  }

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
    if ((call as CallRow).status === 'active') {
      // GROUP CALLS: the first accept flips ringing -> active; every LATER
      // accept lands here. This used to 400 ("Call Not Ringing"), which is
      // the single rule that made 3-way calls impossible — the second
      // accepter was told the call didn't exist and their client treated it
      // as a decline. An active call is a call you can JOIN: any participant
      // of the conversation may mint a LiveKit token for it, so acknowledge
      // and let them in.
      await recordCallTelemetry('messenger_call.join', user.id, {
        call_id: (call as CallRow).id,
        conversation_id: (call as CallRow).conversation_id,
        initiator_id: (call as CallRow).initiator_id,
        call_type: (call as CallRow).call_type,
      }, ip, ua);
      return NextResponse.json({ call, alreadyAccepted: true });
    }
    if ((call as CallRow).status !== 'ringing') {
      return NextResponse.json({ error: 'Call Has Ended' }, { status: 400 });
    }
    const { data: updated, error: upErr } = await svc
      .from('messenger_calls')
      .update({ status: 'active', answered_at: new Date().toISOString() })
      .eq('id', callId)
      .eq('status', 'ringing')
      .select('*')
      .maybeSingle();
    if (upErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    if (!updated) {
      const { data: current } = await svc
        .from('messenger_calls')
        .select('*')
        .eq('id', callId)
        .maybeSingle();
      return NextResponse.json({ call: current, alreadyAccepted: true });
    }

    const startedAt = new Date((updated as CallRow).started_at).getTime();
    const answeredAt = new Date((updated as CallRow).answered_at!).getTime();
    await recordCallTelemetry('messenger_call.accept', user.id, {
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
      // Someone else already accepted (group) or the call resolved — a late
      // decline is a no-op, not an error worth a red toast.
      return NextResponse.json({ call, alreadyResolved: true });
    }

    // GROUP CALLS: one person declining must not tear the call down for the
    // people still being rung — Bob declining cannot hang up on Carol. Leave
    // the row ringing; if nobody ever accepts, the mark-missed-calls cron
    // flips it to missed after 60s exactly as it does today.
    const { data: declConv } = await svc
      .from('messenger_conversations')
      .select('type')
      .eq('id', (call as CallRow).conversation_id)
      .maybeSingle();
    if (((declConv as { type?: string } | null)?.type ?? 'direct') !== 'direct') {
      await recordCallTelemetry('messenger_call.decline', user.id, {
        call_id: (call as CallRow).id,
        conversation_id: (call as CallRow).conversation_id,
        initiator_id: (call as CallRow).initiator_id,
        call_type: (call as CallRow).call_type,
        reason: 'group_decline',
      }, ip, ua);
      return NextResponse.json({ call, groupDecline: true });
    }
    const { data: updated, error: upErr } = await svc
      .from('messenger_calls')
      .update({ status: 'declined', ended_at: new Date().toISOString() })
      .eq('id', callId)
      .eq('status', 'ringing')
      .select('*')
      .maybeSingle();
    if (upErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    if (!updated) {
      const { data: current } = await svc
        .from('messenger_calls')
        .select('*')
        .eq('id', callId)
        .maybeSingle();
      return NextResponse.json({ call: current, alreadyResolved: true });
    }

    const typeStr = (updated as CallRow).call_type === 'video' ? 'Video' : 'Voice';
    await svc.from('messenger_messages').insert({
      conversation_id: (updated as CallRow).conversation_id,
      sender_id: (updated as CallRow).initiator_id,
      message_type: 'system',
      text: `Missed ${typeStr} Call`,
      status: 'sent',
      metadata: { call_id: (updated as CallRow).id, status: 'declined' }
    });

    await recordCallTelemetry('messenger_call.decline', user.id, {
      call_id: (updated as CallRow).id,
      conversation_id: (updated as CallRow).conversation_id,
      initiator_id: (updated as CallRow).initiator_id,
      call_type: (updated as CallRow).call_type,
      reason: 'declined',
    }, ip, ua);

    return NextResponse.json({ call: updated });
  }

  const callerIsInitiator = (call as CallRow).initiator_id === user.id;
  const callIsActive = (call as CallRow).status === 'active';
  const callerCanHangup = callerIsInitiator || callIsActive;
  if (!callerCanHangup) {
    return NextResponse.json({ error: 'Only The Initiator Can End A Ringing Call' }, { status: 403 });
  }

  if ((call as CallRow).status === 'ended' || (call as CallRow).status === 'declined' || (call as CallRow).status === 'missed') {
    return NextResponse.json({ call });
  }
  // Compare-and-swap, like accept and decline already do. Two people saying
  // "bye" and tapping at the same instant — or the last two clients' alone-
  // timers firing in the same second — both read 'active', both updated, and
  // both wrote a "Call Ended" system message. The conversation showed the call
  // ending twice. Narrowing the update to rows that are STILL live means the
  // loser gets updated === null and writes nothing.
  const { data: updated, error: upErr } = await svc
    .from('messenger_calls')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', callId)
    .in('status', ['ringing', 'active'])
    .select('*')
    .maybeSingle();
  if (upErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });

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

       await recordCallTelemetry('messenger_call.hangup', user.id, {
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

       await recordCallTelemetry('messenger_call.hangup', user.id, {
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
