import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCronAuth } from '@/lib/messenger/server';
import { captureCallError, captureCallEvent, recordCallMetric } from '@/lib/messenger/sentryCall';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
      .select('id, conversation_id, initiator_id, call_type, answered_at, ended_at'),
  ]);

  if (missedRes.error) {
    captureCallError(missedRes.error, 'sweep', { branch: 'missed' });
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
  if (staleRes.error) {
    captureCallError(staleRes.error, 'sweep', { branch: 'stale_active' });
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

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

  const markedMissed = (missedRes.data ?? []).length;
  const closedStaleActive = (staleRes.data ?? []).length;

  // audit15 fix-25 (B9): emit Sentry metrics so dashboards can graph
  // these counts and alerts can fire on spikes. recordCallMetric
  // emits one event per metric (info level) — even zero values are
  // useful for confirming the cron is running.
  recordCallMetric('mark_missed_calls.marked_missed', markedMissed);
  recordCallMetric('mark_missed_calls.closed_stale_active', closedStaleActive);

  // High-signal alert when stale-active sweeps trigger. A sustained
  // non-zero rate here means users are losing calls without a clean
  // hangup — pages don't close cleanly, sendBeacon failing, etc.
  if (closedStaleActive > 0) {
    captureCallEvent(
      `Cron mark-missed-calls swept ${closedStaleActive} stale active calls (>4h old)`,
      'sweep',
      closedStaleActive >= 5 ? 'warning' : 'info',
      { closed_stale_active: closedStaleActive, marked_missed: markedMissed },
    );
  }

  return NextResponse.json({
    marked_missed: markedMissed,
    closed_stale_active: closedStaleActive,
  });
}
