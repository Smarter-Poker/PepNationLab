import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, canInvite, isBlockedEither, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { StartConversationSchema } from '@/lib/messenger/schemas';

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
  const parsed = StartConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const svc = await createServiceClient();
  const ids = Array.from(new Set([user.id, ...parsed.data.participantIds]));

  // Audit9: enforce minimum participant count by type. Without this a caller
  // could pass `participantIds: [<self>]` and the dedupe collapses to a
  // self-only conversation.
  if (parsed.data.type === 'direct' && ids.length !== 2) {
    return NextResponse.json({ error: 'Direct Conversation Requires Exactly Two Participants' }, { status: 400 });
  }
  if (parsed.data.type !== 'direct' && ids.length < 2) {
    return NextResponse.json({ error: 'Group Conversation Requires At Least One Other Participant' }, { status: 400 });
  }

  for (const targetId of parsed.data.participantIds) {
    if (targetId === user.id) continue;
    const allowed = await canInvite(user.id, targetId);
    if (!allowed) {
      return NextResponse.json({ error: 'Cannot Invite User', userId: targetId }, { status: 403 });
    }
    if (await isBlockedEither(user.id, targetId)) {
      return NextResponse.json({ error: 'User Blocked', userId: targetId }, { status: 403 });
    }
  }

  // Audit9: pairwise block check between every distinct pair in group/announcement,
  // so an inviter cannot create a room containing two users who block each other.
  if (parsed.data.type !== 'direct') {
    for (let i = 0; i < parsed.data.participantIds.length; i++) {
      for (let j = i + 1; j < parsed.data.participantIds.length; j++) {
        const a = parsed.data.participantIds[i];
        const b = parsed.data.participantIds[j];
        if (a === b) continue;
        if (await isBlockedEither(a, b)) {
          return NextResponse.json({ error: 'Two Invitees Have Blocked Each Other', users: [a, b] }, { status: 403 });
        }
      }
    }
  }

  if (parsed.data.type === 'direct' && ids.length === 2) {
    const { data: existingId } = await svc.rpc('fn_find_direct_conversation', { a: ids[0], b: ids[1] });
    if (existingId) {
      // Audit9: re-check the caller is still a participant of the cached
      // direct conversation (could have been removed between calls).
      const stillIn = await getParticipant(existingId as string, user.id);
      if (stillIn) return NextResponse.json({ conversationId: existingId });
    }
  }

  // Audit11: pass p_caller_id explicitly so the SECURITY DEFINER RPC's
  // service-role / postgres bypass can derive `effective_caller`.
  // Without this the route gets 'unauthorized' because auth.uid() is NULL
  // under the service-role JWT used by createServiceClient().
  const { data: newConvId, error: rpcErr } = await svc.rpc('fn_messenger_create_conversation', {
    p_caller_id: user.id,
    p_type: parsed.data.type,
    p_title: parsed.data.title ?? null,
    p_avatar: parsed.data.avatarUrl ?? null,
    p_participant_ids: ids,
  });

  if (rpcErr || !newConvId) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  return NextResponse.json({ conversationId: newConvId });
}
