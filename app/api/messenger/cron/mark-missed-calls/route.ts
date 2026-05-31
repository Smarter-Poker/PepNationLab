import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCronAuth } from '@/lib/messenger/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Audit9: ringing-call timeout (60s -> missed) so the next call slot in the
// conversation is not wedged forever.
//
// Audit10 extension: also sweep 'active' calls older than 4 hours. With the
// CallOverlay onDisconnected handler now routing only to onClose (no
// auto-hangup on transient disconnect), a stale 'active' row could otherwise
// sit forever if both parties closed the tab without sendBeacon firing.
export async function GET(req: NextRequest) {
  const auth = getCronAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const svc = await createServiceClient();
  const nowIso = new Date().toISOString();
  const ringingCutoff = new Date(Date.now() - 60_000).toISOString();
  const activeCutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  const [missedRes, staleRes] = await Promise.all([
    svc
      .from('messenger_calls')
      .update({ status: 'missed', ended_at: nowIso })
      .eq('status', 'ringing')
      .lt('started_at', ringingCutoff)
      .select('id, conversation_id, initiator_id, call_type'),
    svc
      .from('messenger_calls')
      .update({ status: 'ended', ended_at: nowIso })
      .eq('status', 'active')
      .lt('answered_at', activeCutoff)
      // audit15 fix-15: select the columns we need to compose the system
      // message + compute duration. Previously only selecting `id` because
      // the dropped DB trigger handled the message; now the cron has to.
      .select('id, conversation_id, initiator_id, call_type, answered_at, ended_at'),
  ]);

  if (missedRes.error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  if (staleRes.error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  if (missedRes.data && missedRes.data.length > 0) {
    const messagesToInsert = missedRes.data.map(call => {
      const typeStr = call.call_type === 'video' ? 'Video' : 'Voice';
      return {
        conversation_id: call.conversation_id,
        sender_id: call.initiator_id,
        message_type: 'system',
        text: `Missed ${typeStr} Call`,
        status: 'sent',
        metadata: { call_id: call.id, status: 'missed_timeout' }
      };
    });

    if (messagesToInsert.length > 0) {
      await svc.from('messenger_messages').insert(messagesToInsert);
    }
  }

  // audit15 fix-15: stale-active rows also get a system message. Duration is
  // computed from answered_at to the cron's nowIso (we just set ended_at to
  // nowIso, but the row in `staleRes.data` reflects the UPDATE so ended_at
  // is the new value). Format matches the route's "Voice/Video Call Ended
  // (Xm Ys)" pattern used on a user-initiated hangup of an active call so
  // the chat looks consistent regardless of who closed the row.
  if (staleRes.data && staleRes.data.length > 0) {
    const staleMessages = staleRes.data
      .map((call: { id: string; conversation_id: string; initiator_id: string; call_type: 'audio' | 'video'; answered_at: string | null; ended_at: string | null }) => {
        if (!call.answered_at || !call.ended_at) return null;
        const typeStr = call.call_type === 'video' ? 'Video' : 'Voice';
        const startMs = new Date(call.answered_at).getTime();
        const endMs = new Date(call.ended_at).getTime();
        const diffSecs = Math.max(0, Math.floor((endMs - startMs) / 1000));
        const mins = Math.floor(diffSecs / 60);
        const secs = diffSecs % 60;
        const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        return {
          conversation_id: call.conversation_id,
          sender_id: call.initiator_id,
          message_type: 'system',
          text: `${typeStr} Call Ended (${durationStr})`,
          status: 'sent',
          metadata: { call_id: call.id, status: 'ended_stale_sweep', duration: diffSecs }
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    if (staleMessages.length > 0) {
      await svc.from('messenger_messages').insert(staleMessages);
    }
  }

  return NextResponse.json({
    marked_missed: (missedRes.data ?? []).length,
    closed_stale_active: (staleRes.data ?? []).length,
  });
}
