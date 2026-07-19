import { NextResponse } from 'next/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { createAdminClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notify';
import { emailConfigured, sendAdminDigestEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cron/admin-digest  (daily 12:30 UTC = 7:30am Chicago; vercel.json)
 *
 * Daily operations digest for every admin: last-24h order count + sales
 * volume + cancellations, and a live snapshot of everything stuck in the
 * pipeline (awaiting customer payment / agent approval / admin approval,
 * with over-24h aging counts). Delivered as an email (verified contact email
 * first, auth email fallback) plus an in-app notification summary.
 *
 * Auth: Vercel cron Authorization: Bearer ${CRON_SECRET}.
 * Idempotent per day via cron_runs UNIQUE (job_name, partition_key).
 */
export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const startedAt = new Date();
  const partitionKey = startedAt.toISOString().slice(0, 10);
  const claim = await claimCronRun('admin_digest', partitionKey);
  if (!claim) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_ran_today' });
  }

  try {
    const admin = createAdminClient();
    const now = Date.now();
    const dayAgoIso = new Date(now - 24 * 3600_000).toISOString();
    const agingIso = dayAgoIso;

    const [
      { data: recent },
      { count: pendingPayment },
      { count: pendingPaymentAging },
      { count: agentApprovalPending },
      { count: agentApprovalAging },
      { count: adminApprovalPending },
      { count: shippedInTransit },
    ] = await Promise.all([
      admin.from('orders').select('total, status, created_at').gte('created_at', dayAgoIso).limit(2000),
      admin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending_customer_payment'),
      admin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending_customer_payment').lt('created_at', agingIso),
      admin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'agent_approval_pending'),
      admin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'agent_approval_pending').lt('created_at', agingIso),
      admin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'admin_approval_pending'),
      admin.from('orders').select('id', { count: 'exact', head: true }).in('status', ['approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped']),
    ]);

    const recentRows = (recent ?? []) as Array<{ total: number | null; status: string }>;
    const nonCancelled = recentRows.filter((r) => r.status !== 'cancelled');
    const stats = {
      orders24h: nonCancelled.length,
      gmv24h: Math.round(nonCancelled.reduce((s, r) => s + (Number(r.total) || 0), 0) * 100) / 100,
      cancelled24h: recentRows.filter((r) => r.status === 'cancelled').length,
      pendingPayment: pendingPayment ?? 0,
      pendingPaymentAging: pendingPaymentAging ?? 0,
      agentApprovalPending: agentApprovalPending ?? 0,
      agentApprovalAging: agentApprovalAging ?? 0,
      adminApprovalPending: adminApprovalPending ?? 0,
      shippedInTransit: shippedInTransit ?? 0,
    };

    const { data: admins } = await admin
      .from('profiles')
      .select('id, full_name, contact_email, email_verified')
      .eq('role', 'admin');

    let emailed = 0;
    let notified = 0;
    const money = `$${stats.gmv24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    for (const a of admins ?? []) {
      // In-app summary for the bell feed.
      try {
        await notify(admin, {
          userId: a.id,
          type: 'system',
          title: `Daily Digest: ${stats.orders24h} Orders / ${money} (24h)`,
          body: `Stuck: ${stats.pendingPaymentAging} Awaiting Payment 24h+, ${stats.agentApprovalAging} Awaiting Agent 24h+, ${stats.adminApprovalPending} Awaiting Admin Release.`,
          url: '/admin/orders',
          withPush: false,
        });
        notified++;
      } catch { /* per-admin best-effort */ }

      // Email: verified contact email first, auth email fallback.
      if (!emailConfigured()) continue;
      try {
        let to: string | null = (a.contact_email && a.email_verified) ? a.contact_email : null;
        if (!to) {
          const { data: authUser } = await admin.auth.admin.getUserById(a.id);
          to = authUser?.user?.email ?? null;
        }
        if (to) {
          const res = await sendAdminDigestEmail({ to, adminName: a.full_name, stats });
          if (res.ok && !res.skipped) emailed++;
        }
      } catch { /* per-admin best-effort */ }
    }

    const summary = `orders24h: ${stats.orders24h}, gmv: ${stats.gmv24h}, emailed: ${emailed}, notified: ${notified}`;
    await finishCronRun(claim.id, 'succeeded', summary);
    return NextResponse.json({ ok: true, stats, emailed, notified, partition: partitionKey });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    await finishCronRun(claim.id, 'failed', msg.slice(0, 200));
    console.error('[admin-digest] crash:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
