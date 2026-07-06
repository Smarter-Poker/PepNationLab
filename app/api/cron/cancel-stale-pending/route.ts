import { NextResponse } from 'next/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cron/cancel-stale-pending
 *
 * Daily sweep that cancels pending_customer_payment orders older than the
 * configured grace window. The RPC handles inventory refund, super-agent
 * commission void, and coupon unredemption inside one transaction.
 *
 * Auth: Vercel cron Authorization: Bearer ${CRON_SECRET}.
 * Schedule (vercel.json): 45 3 * * *  (daily 03:45 UTC).
 * Idempotent: cron_runs claims via UNIQUE (job_name, partition_key).
 */
export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const startedAt = new Date();
  const partitionKey = startedAt.toISOString().slice(0, 10);
  const claim = await claimCronRun('cancel-stale-pending', partitionKey);
  if (!claim) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_ran_today' });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('cancel_stale_pending_orders', { p_hours: 72 });
    if (error) {
      await finishCronRun(claim.id, 'failed', `rpc error: ${error.message.slice(0, 200)}`);
      console.error('[cancel-stale-pending] rpc failed:', error);
      return NextResponse.json({ ok: false, error: 'rpc failed' }, { status: 500 });
    }
    const cancelled = Number(data ?? 0);
    await finishCronRun(
      claim.id,
      'succeeded',
      `cancelled ${cancelled} stale pending order(s)`
    );
    return NextResponse.json({ ok: true, cancelled, partition: partitionKey });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    await finishCronRun(claim.id, 'failed', msg.slice(0, 200));
    console.error('[cancel-stale-pending] crash:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
