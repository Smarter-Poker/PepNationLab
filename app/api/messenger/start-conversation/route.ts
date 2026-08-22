
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession, canInvite, isBlockedEither, getParticipant } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';
import { StartConversationSchema } from '@/lib/messenger/schemas';
import { sendBroadcast } from '@/lib/messenger/broadcast';
import { notify } from '@/lib/notify';

/** "A", "A And B", "A, B, And C" - readable member list for the announcement. */
function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} And ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, And ${names[names.length - 1]}`;
}

/**
 * Owner report 2026-08-19: creating a group did NOTHING visible for its
 * members. The row landed in the database, but no message, no broadcast, no
 * bell entry - so the group never appeared in anyone's messenger until a
 * human happened to send the first message AND the member happened to be on
 * /messenger to catch it. This function makes creation itself the first
 * event: a system message announcing who is in the group (which also bumps
 * last_message_at so the thread sorts to the TOP of every member's list and
 * increments their unread badge via trg_mm_after_insert), a realtime fanout
 * to every member so open clients refresh instantly, and a durable bell
 * notification + web push for the members who were added. Best-effort: a
 * failure here must never fail the creation itself.
 */
async function announceGroupCreated(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  conversationId: string,
  creatorId: string,
  memberIds: string[],
  title: string | null,
): Promise<void> {
  try {
    const { data: profs } = await svc
      .from('profiles')
      .select('id, full_name, username, email')
      .in('id', memberIds);
    const nameOf = (id: string): string => {
      const p = (profs ?? []).find((r: { id: string }) => r.id === id) as
        | { full_name?: string | null; username?: string | null; email?: string | null }
        | undefined;
      return (
        (p?.full_name && String(p.full_name).trim()) ||
        (p?.username && String(p.username).trim()) ||
        (p?.email && String(p.email).split('@')[0]) ||
        'Someone'
      );
    };
    const creatorName = nameOf(creatorId);
    const otherIds = memberIds.filter((id) => id !== creatorId);
    const otherNames = joinNames(otherIds.map(nameOf));
    const text = title
      ? `${creatorName} Created The Group "${title}" With ${otherNames}`
      : `${creatorName} Created A Group With ${otherNames}`;

    const { data: sysMsg, error: msgErr } = await svc
      .from('messenger_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: creatorId,
        message_type: 'system',
        text,
        status: 'sent',
        metadata: { group_created: true, member_ids: memberIds },
      })
      .select('*')
      .maybeSingle();
    if (msgErr || !sysMsg) {
      console.warn('[start-conversation] group announcement insert failed:', msgErr?.message);
      return;
    }

    // Realtime fanout. `new_message_notify` on each member's user_notify
    // channel is the signal MessengerShell treats as "a conversation I have
    // never seen exists - refetch the list" (see subscribeMyIncomingMessages).
    // The conversation channel broadcast covers anyone who opens the thread
    // within the same second. One REST call carries all of it.
    const broadcasts = memberIds.map((uid) => ({
      topic: `user_notify:${uid}`,
      event: 'new_message_notify',
      payload: { message: sysMsg },
    }));
    broadcasts.push({
      topic: `conversation:${conversationId}`,
      event: 'new_message',
      payload: { message: sysMsg },
    });
    await sendBroadcast(broadcasts);

    // Unread badge fanout: trg_mm_after_insert already incremented every
    // non-sender's unread_count; broadcast the fresh rows so navbar badges
    // update without a reload.
    try {
      const { data: parts } = await svc
        .from('messenger_participants')
        .select('conversation_id, user_id, unread_count, is_muted, last_read_at')
        .eq('conversation_id', conversationId);
      if (parts && parts.length > 0) {
        await sendBroadcast(
          (parts as Array<{ user_id: string }>).map((p) => ({
            topic: `user_unread:${p.user_id}`,
            event: 'participant_updated',
            payload: { participant: p },
          })),
        );
      }
    } catch { /* badge fanout is best-effort */ }

    // Durable bell entry + web push for every ADDED member, so being put in
    // a group is announced even when the member is offline right now.
    await Promise.allSettled(
      otherIds.map((uid) =>
        notify(svc, {
          userId: uid,
          type: 'new_message',
          title: 'New Group Message',
          body: title
            ? `${creatorName} Added You To The Group "${title}"`
            : `${creatorName} Added You To A New Group`,
          url: `/messenger?conv=${conversationId}`,
        }),
      ),
    );
  } catch (err) {
    console.warn('[start-conversation] group announcement failed:', err);
  }
}

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
    p_title: parsed.data.title ?? null, // @ts-ignore
    p_avatar: parsed.data.avatarUrl ?? null, // @ts-ignore
    p_participant_ids: ids,
  });

  if (rpcErr || !newConvId) {
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }

  // Group and announcement conversations announce themselves the moment they
  // are created: system message naming the members, realtime list refresh for
  // every member, bell notification + push for the added members. Without
  // this the group was invisible to everyone until the first human message.
  if (parsed.data.type !== 'direct') {
    await announceGroupCreated(
      svc,
      newConvId as string,
      user.id,
      ids,
      parsed.data.title?.trim() ? parsed.data.title.trim() : null,
    );
  }

  return NextResponse.json({ conversationId: newConvId });
}
