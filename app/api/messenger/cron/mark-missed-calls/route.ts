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
      .select('id'),
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
        text: `📞 Missed ${typeStr} Call`,
        status: 'sent',
        metadata: { call_id: call.id, status: 'missed_timeout' }
      };
    });
    
    if (messagesToInsert.length > 0) {
      await svc.from('messenger_messages').insert(messagesToInsert);
    }
  }

  return NextResponse.json({
    marked_missed: (missedRes.data ?? []).length,
    closed_stale_active: (staleRes.data ?? []).length,
  });
}

