import { NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron';
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

  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc('coupons_daily_expiry_sweep');
  if (error) {
    console.error('[cron/coupons-expire] rpc error:', error.message);
    return safeError('cron.coupons_expire', error);
  }
  return NextResponse.json({ ok: true, expired: Number(data) || 0 });
}
