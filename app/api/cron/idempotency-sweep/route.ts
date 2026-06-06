import { NextResponse } from 'next/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cron/idempotency-sweep
 *
 * Daily sweep that deletes rows from public.idempotency_keys whose
 * expires_at has passed. The table is the cache backing lib/idempotency.ts
 * (Stripe-style Idempotency-Key replay layer) and the default TTL is
 * 24 hours, so without this sweep the table would grow indefinitely.
 *
 * Auth: Vercel cron Authorization: Bearer ${CRON_SECRET}.
 * Schedule: vercel.json - daily at 04:00 UTC (low-traffic window).
 *
 * Idempotent by design: cron_runs claims via the UNIQUE (job_name,
 * partition_key) constraint, so even if the schedule double-fires we
 * only delete once per day.
 */
export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const startedAt = new Date();
  // Partition by UTC day so a same-day re-trigger is a clean no-op
  // (cron_runs UNIQUE (job_name, partition_key) blocks the second insert).
  const partitionKey = startedAt.toISOString().slice(0, 10);
  const claim = await claimCronRun('idempotency-sweep', partitionKey);
  if (!claim) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_ran_today' });
  }

  const admin = await createServiceClient();
  let deleted = 0;
  try {
    const { data, error, count } = await admin
      .from('idempotency_keys')
      .delete({ count: 'exact' })
      .lt('expires_at', startedAt.toISOString())
      .select('key');

    if (error) {
      await finishCronRun(claim.id, 'failed', `delete error: ${error.message.slice(0, 200)}`);
      console.error('[idempotency-sweep] delete failed:', error);
      return NextResponse.json({ ok: false, error: 'sweep failed' }, { status: 500 });
    }

    deleted = typeof count === 'number' ? count : (data?.length ?? 0);
    await finishCronRun(
      claim.id,
      'succeeded',
      `deleted ${deleted} expired idempotency_keys row(s)`
    );
    return NextResponse.json({ ok: true, deleted, partition: partitionKey });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    await finishCronRun(claim.id, 'failed', msg.slice(0, 200));
    console.error('[idempotency-sweep] crash:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
