import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

/**
 * POST /api/researcher/referrals/apply
 *
 * Body: { code: string }
 *
 * Calls the SECURITY DEFINER RPC apply_referral_code which:
 *   - validates the code maps to an active researcher
 *   - rejects self-referral
 *   - rejects callers who have already redeemed a code
 *   - rejects when the referral program is paused
 *   - inserts a researcher_referrals row in 'qualifying' status
 *
 * The reward is issued later by the cron when the referee completes their
 * first qualifying order.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid Body' }, { status: 400 });
  }

  const code = String(body?.code ?? '').trim();
  if (!code) {
    return NextResponse.json({ error: 'Code Is Required' }, { status: 400 });
  }
  if (code.length > 32) {
    return NextResponse.json({ error: 'Invalid Code' }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: referralId, error } = await service.rpc('apply_referral_code', {
    p_referee_id: user.id,
    p_code: code,
  });

  if (error) {
    // PG RAISE EXCEPTION surfaces here as a 400 to the caller with the
    // human-readable Title Case message defined in the RPC.
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 400 });
  }

  // Re-fetch the just-created row for the client.
  const { data: row } = await service
    .from('researcher_referrals')
    .select('id, referrer_id, referee_id, code, status, referee_reward_amount, applied_at, expires_at')
    .eq('id', referralId as string)
    .maybeSingle();

  return NextResponse.json({ referral: row ?? null }, { status: 201 });
}
