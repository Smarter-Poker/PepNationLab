import { NextResponse } from 'next/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/proof-review-reminders (hourly)
 *
 * A researcher sent a payment screenshot but nobody has confirmed the money:
 *   - unreviewed >= 3 hours  -> remind the order's agent
 *   - unreviewed >= 12 hours -> also alert the agent's upline super agent
 *
 * Only fires while the order is still pending_customer_payment (mark-paid
 * stamps the proof verified AND moves the status, so confirmed orders drop
 * out on both axes). Deduped to at most one reminder per recipient per order
 * per 24h via a title-match against the notifications table - no new schema.
 */
export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const claim = await claimCronRun('proof_review_reminders', partitionKey);
  if (!claim) {
    return NextResponse.json({ skipped: true, reason: 'already_ran_this_hour' });
  }

  try {
    const svc = createAdminClient();
    const now = Date.now();
    const cutoff3h = new Date(now - 3 * 3600_000).toISOString();
    const cutoff12h = new Date(now - 12 * 3600_000).toISOString();
    const dedupeSince = new Date(now - 24 * 3600_000).toISOString();

    const { data: proofs, error: proofsErr } = await svc
      .from('payment_proofs')
      .select('id, order_id, uploaded_at')
      .is('verified_at', null)
      .lte('uploaded_at', cutoff3h)
      .order('uploaded_at', { ascending: true })
      .limit(100);
    if (proofsErr) {
      await finishCronRun(claim.id, 'failed', proofsErr.message.slice(0, 500));
      return NextResponse.json({ ok: false, error: 'query failed' }, { status: 500 });
    }

    // One reminder per ORDER per run even if several proofs are pending on it.
    const seenOrders = new Set<string>();
    let agentReminders = 0;
    let uplineAlerts = 0;

    for (const proof of proofs ?? []) {
      if (seenOrders.has(proof.order_id)) continue;
      seenOrders.add(proof.order_id);

      const { data: order } = await svc
        .from('orders')
        .select('id, agent_id, status')
        .eq('id', proof.order_id)
        .maybeSingle();
      if (!order || order.status !== 'pending_customer_payment' || !order.agent_id) continue;

      const shortId = order.id.slice(0, 8).toUpperCase();
      const waitedHrs = Math.floor((now - Date.parse(proof.uploaded_at)) / 3600_000);

      // Agent reminder (>= 3h), deduped per 24h.
      const { count: agentSent } = await svc
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', order.agent_id)
        .eq('type', 'order_attention')
        .ilike('title', `%Proof Awaiting Review%${shortId}%`)
        .gte('created_at', dedupeSince);
      if (!agentSent) {
        await notify(svc, {
          userId: order.agent_id,
          type: 'order_attention',
          title: `Payment Proof Awaiting Review: Order #${shortId}`,
          body: `A Payment Screenshot For Order #${shortId} Has Been Waiting ${waitedHrs} Hours For Your Review. Open The Chat Or Your Orders Tab And Mark It Paid Once Verified.`,
          url: `/dashboard/agent?tab=Orders&order=${shortId}`,
        });
        agentReminders++;
      }

      // Upline escalation (>= 12h), deduped per 24h.
      if (proof.uploaded_at <= cutoff12h) {
        const { data: agentProf } = await svc
          .from('profiles')
          .select('parent_agent_id, full_name')
          .eq('id', order.agent_id)
          .maybeSingle();
        if (agentProf?.parent_agent_id) {
          const { count: uplineSent } = await svc
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', agentProf.parent_agent_id)
            .eq('type', 'order_attention')
            .ilike('title', `%Proof Unreviewed%${shortId}%`)
            .gte('created_at', dedupeSince);
          if (!uplineSent) {
            await notify(svc, {
              userId: agentProf.parent_agent_id,
              type: 'order_attention',
              title: `Downline Payment Proof Unreviewed: Order #${shortId}`,
              body: `${agentProf.full_name || 'Your Sub-Agent'} Has Not Reviewed A Payment Screenshot On Order #${shortId} For ${waitedHrs} Hours. Please Follow Up.`,
              url: `/dashboard/agent?tab=Orders&order=${shortId}`,
            });
            uplineAlerts++;
          }
        }
      }
    }

    await finishCronRun(claim.id, 'succeeded', `agent=${agentReminders} upline=${uplineAlerts} scanned=${(proofs ?? []).length}`);
    return NextResponse.json({ ok: true, agentReminders, uplineAlerts, scanned: (proofs ?? []).length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('[cron/proof-review-reminders] unexpected error:', msg);
    await finishCronRun(claim.id, 'failed', msg.slice(0, 500));
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
