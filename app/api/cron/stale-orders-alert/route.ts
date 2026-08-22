import { NextResponse } from 'next/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cron/stale-orders-alert (hourly at 0 * * * *)
 *
 * Checks for orders stuck in agent_approval_pending or pending_customer_payment
 * for EXACTLY 24 to 25 hours. Sends an in-app notification to all admins for each found order.
 */
export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const now = new Date();
  const partitionKey = `${now.toISOString().slice(0, 10)}-${now.getHours()}`;
  const claim = await claimCronRun('stale_orders_alert', partitionKey);
  if (!claim) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_ran_this_hour' });
  }

  try {
    const admin = createAdminClient();
    const endWindow = new Date(now.getTime() - 24 * 3600_000).toISOString();
    const startWindow = new Date(now.getTime() - 25 * 3600_000).toISOString();

    const { data: stuckOrders } = await admin
      .from('orders')
      .select('id, short_id, status')
      .in('status', ['agent_approval_pending', 'pending_customer_payment'])
      .gte('created_at', startWindow)
      .lt('created_at', endWindow);

    if (!stuckOrders || stuckOrders.length === 0) {
      await finishCronRun(claim.id, 'succeeded', '0 stuck orders');
      return NextResponse.json({ ok: true, count: 0, partition: partitionKey });
    }

    const { data: admins } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    let notified = 0;
    if (admins && admins.length > 0) {
      for (const order of stuckOrders) {
        const readableStatus = order.status === 'agent_approval_pending' ? 'Agent Approval' : 'Customer Payment';
        for (const a of admins) {
          try {
            await notify(admin, {
              userId: a.id,
              type: 'system',
              title: `Stuck Order Alert: #${order.short_id}`,
              body: `Order #${order.short_id} has been stuck awaiting ${readableStatus} for over 24 hours.`,
              url: `/admin/orders?search=${order.short_id}`,
              withPush: true,
            });
            notified++;
          } catch {
            // best effort
          }
        }
      }
    }

    const summary = `Found ${stuckOrders.length} stuck orders, sent ${notified} notifications.`;
    await finishCronRun(claim.id, 'succeeded', summary);
    return NextResponse.json({ ok: true, count: stuckOrders.length, notified, partition: partitionKey });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    await finishCronRun(claim.id, 'failed', msg.slice(0, 200));
    console.error('[stale-orders-alert] crash:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
