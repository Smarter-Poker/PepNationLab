import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, getParticipant, isBlocked } from '@/lib/messenger/server';
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
}

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
    .select('id, conversation_id, initiator_id, call_type, status, livekit_room')
    .eq('id', parsed.data.callId)
    .maybeSingle();
  if (!call) return NextResponse.json({ error: 'Call Not Found' }, { status: 404 });

  const callerPart = await getParticipant((call as CallRow).conversation_id, user.id);
  if (!callerPart) return NextResponse.json({ error: 'Not A Participant' }, { status: 403 });

  const status = (call as CallRow).status;
  if (status === 'ended' || status === 'declined' || status === 'missed') {
    return NextResponse.json({ error: 'Call No Longer Active' }, { status: 410 });
  }

  // Audit3 fix: if the caller is in a direct conversation and either side has
  // a block in place, deny the token. Caller is either the initiator (rare,
  // see call-signal guard) or the accepter. The block guard at the token
  // layer keeps a stale invite that survives a mid-call block from working.
  const { data: convCheck } = await svc
    .from('messenger_conversations')
    .select('id, type')
    .eq('id', (call as CallRow).conversation_id)
    .maybeSingle();
  if (convCheck && convCheck.type === 'direct') {
    const { data: others } = await svc
      .from('messenger_participants')
      .select('user_id')
      .eq('conversation_id', (call as CallRow).conversation_id)
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

  try {
    const { AccessToken } = await import('livekit-server-sdk');
    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: user.email ?? user.id,
      ttl: '1h',
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
