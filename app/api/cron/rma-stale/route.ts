import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';

export const dynamic = 'force-dynamic';

const STALE_LABEL_DAYS = 14;
const STALE_REQUEST_DAYS = 3;

/**
 * Daily cron — surfaces stuck RMAs.
 *
 * - RMAs in label_sent for > 14 days: alert admins (in-app) so a manual
 *   investigation can happen (we don't yet have a Shippo tracking webhook).
 * - RMAs in requested for > 3 days: nudge the buyer with a reminder.
 */
export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partition = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const claim = await claimCronRun('rma_stale', partition);
  if (!claim) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_ran_today' });
  }

  const summary = { stale_labels: 0, stale_requests: 0, admin_alerts: 0, buyer_reminders: 0 };

  try {
    const service = await createServiceClient();

    const now = Date.now();
    const labelCutoff = new Date(now - STALE_LABEL_DAYS * 86_400_000).toISOString();
    const requestCutoff = new Date(now - STALE_REQUEST_DAYS * 86_400_000).toISOString();

    // Stale label_sent RMAs — alert admins.
    const { data: stuckLabels } = await service
      .from('rma_requests')
      .select('id, return_tracking_number, order_id, return_label_purchased_at')
      .eq('status', 'label_sent')
      .lt('return_label_purchased_at', labelCutoff);
    summary.stale_labels = stuckLabels?.length ?? 0;

    if (summary.stale_labels > 0) {
      const { data: admins } = await service
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('is_active', true);

      for (const rma of stuckLabels ?? []) {
        for (const a of admins ?? []) {
          await service.from('internal_messages').insert({
            sender_id: a.id, // self-addressed alert (system surrogate)
            receiver_id: a.id,
            subject: 'Stale Return Label Alert',
            body: `Return Request ${rma.id.slice(0, 8).toUpperCase()} Has Been In Label Sent For More Than ${STALE_LABEL_DAYS} Days. Tracking: ${rma.return_tracking_number || 'Unknown'}. Please Investigate.`,
            type: 'direct_message',
          });
          summary.admin_alerts += 1;
        }
      }
    }

    // Stale requested RMAs — nudge buyer + agent.
    const { data: stuckRequests } = await service
      .from('rma_requests')
      .select('id, requester_id, order_id, created_at, orders(agent_id)')
      .eq('status', 'requested')
      .lt('created_at', requestCutoff);
    summary.stale_requests = stuckRequests?.length ?? 0;

    for (const rma of stuckRequests ?? []) {
      const order = Array.isArray((rma as any).orders) ? (rma as any).orders[0] : (rma as any).orders;
      const agentId = order?.agent_id;
      if (!agentId || !rma.requester_id) continue;

      await service.from('internal_messages').insert({
        sender_id: agentId,
        receiver_id: rma.requester_id,
        subject: 'Return Request Update Pending',
        body: 'Your Return Request Is Still Under Review. We Apologize For The Delay And Will Update You Soon.',
        type: 'direct_message',
      });
      summary.buyer_reminders += 1;
    }

    await finishCronRun(claim.id, 'succeeded', JSON.stringify(summary));
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = (err as Error)?.message ?? 'Unknown Error';
    await finishCronRun(claim.id, 'failed', message.slice(0, 500));
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
