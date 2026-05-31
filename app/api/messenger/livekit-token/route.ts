import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant, isBlockedEither } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { LivekitTokenSchema } from '@/lib/messenger/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CallRow {
  id: string;
  conversation_id: string;
  initiator_id: string;
  call_type: 'audio' | 'video';
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined';
  livekit_room: string;
  started_at: string | null;
  answered_at: string | null;
}

// fix-39: defensive ceiling — refuse to mint a token if the call has been
// 'active' for longer than any plausible session length. A stale active
// row (cron sweep missed, LiveKit room long-dead) would otherwise lure
// clients into trying to connect to a dead room and crashing on mount.
const MAX_CALL_LIFETIME_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('default', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const body = await req.json().catch(() => ({}));
  const parsed = LivekitTokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !url) {
    return NextResponse.json({ error: 'Calls Not Configured' }, { status: 503 });
  }

  const svc = await createServiceClient();
  const { data: call } = await svc
    .from('messenger_calls')
    .select('id, conversation_id, initiator_id, call_type, status, livekit_room, started_at, answered_at')
    .eq('id', parsed.data.callId)
    .maybeSingle();
  if (!call) return NextResponse.json({ error: 'Call Not Found' }, { status: 404 });

  const callerPart = await getParticipant((call as CallRow).conversation_id, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

  const status = (call as CallRow).status;
  if (status === 'ended' || status === 'declined' || status === 'missed') {
    return NextResponse.json({ error: 'Call No Longer Active' }, { status: 410 });
  }

  // fix-39: stale-active rejection.
  const cr = call as CallRow;
  const anchorIso = cr.answered_at ?? cr.started_at;
  if (anchorIso) {
    const anchor = Date.parse(anchorIso);
    if (Number.isFinite(anchor) && Date.now() - anchor > MAX_CALL_LIFETIME_MS) {
      // Auto-sweep this stale row so future requests don't trip the same
      // path. Best-effort — log and ignore failure.
      try {
        await svc
          .from('messenger_calls')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', cr.id)
          .in('status', ['ringing', 'active']);
      } catch (err) {
        console.warn('[livekit-token] failed to sweep stale call', cr.id, err);
      }
      return NextResponse.json({ error: 'Call No Longer Active' }, { status: 410 });
    }
  }

  const { data: others } = await svc
    .from('messenger_participants')
    .select('user_id')
    .eq('conversation_id', (call as CallRow).conversation_id)
    .neq('user_id', user.id);
  for (const row of (others ?? []) as Array<{ user_id: string }>) {
    if (await isBlockedEither(user.id, row.user_id)) {
      return NextResponse.json({ error: 'User Blocked' }, { status: 403 });
    }
  }

  try {
    const { AccessToken } = await import('livekit-server-sdk');
    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: user.email ?? user.id,
      ttl: '6h',
    });
    at.addGrant({
      roomJoin: true,
      room: (call as CallRow).livekit_room,
      canPublish: true,
      canSubscribe: true,
    });
    const token = await at.toJwt();
    return NextResponse.json({
      token,
      url,
      roomName: (call as CallRow).livekit_room,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token Generation Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
