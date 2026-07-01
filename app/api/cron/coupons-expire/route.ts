import { NextResponse } from 'next/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { createServiceClient } from '@/lib/supabase/server';
import { safeError } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/coupons-expire
 *
 * Daily sweep: flips is_active = false on coupons whose expires_at has
 * passed OR whose uses_count has reached max_uses. The redeem_coupon RPC
 * already rejects expired/exhausted codes at the row level, but flipping
 * is_active also makes the agent's list correctly show "Expired" /
 * "Exhausted" without waiting for an attempted redemption.
 *
 * Idempotent - safe to invoke at any cadence.
 */
export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const claim = await claimCronRun('coupons_expire', partitionKey);
  if (!claim) {
    return NextResponse.json({ skipped: true, reason: 'already_ran_today' });
  }

  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase.rpc('coupons_daily_expiry_sweep');
    if (error) {
      console.error('[cron/coupons-expire] rpc error:', error.message);
      await finishCronRun(claim.id, 'failed', error.message.slice(0, 500));
      return safeError('cron.coupons_expire', error);
    }
    const expired = Number(data) || 0;
    await finishCronRun(claim.id, 'succeeded', `expired=${expired}`);
    return NextResponse.json({ ok: true, expired });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('[cron/coupons-expire] unexpected error:', msg);
    await finishCronRun(claim.id, 'failed', msg.slice(0, 500));
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
