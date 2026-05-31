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

  // Audit10: block-pair gate now applies to direct, group, AND announcement
  // conversations. A blocked user could otherwise still mint a token for a
  // group room shared with their blocker (e.g. blocker is the initiator, the
  // blocked counterpart was added to the group earlier). Iterate all OTHER
  // participants and refuse if any pairwise block exists between the caller
  // and any of them.
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
      // audit15 fix-14 (S4): 6h TTL covers every plausible call length.
      // The room itself is single-use per call (livekit_room is a fresh
      // crypto UUID), so a 6h credential cannot be replayed against any
      // other call. The previous 1h limit produced an unexpected media
      // drop at the 60-minute mark for any long session.
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
