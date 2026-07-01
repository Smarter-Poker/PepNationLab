import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  // CRITICAL: claimCronRun prevents double-credit if cron fires twice in the same day
  // (Vercel can double-trigger on retries or manual re-runs).
  const partitionKey = new Date().toISOString().slice(0, 10);
  const claim = await claimCronRun('referrals-fulfil', partitionKey);
  if (!claim) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_ran_today' });
  }

  try {
    const supabase = await createServiceClient();

    // Fetch all pending referrals that have a qualifying order attached
    const { data: pendingReferrals, error } = await supabase
      .from('researcher_referrals')
      .select('id, referrer_id, referrer_reward_amount')
      .eq('status', 'pending')
      .not('qualifying_order_id', 'is', null);

    if (error) {
      console.error('[referrals-fulfil] fetch error:', error);
      await finishCronRun(claim.id, 'failed', `fetch error: ${error.message.slice(0, 200)}`);
      return NextResponse.json({ error: 'Failed to fetch pending referrals' }, { status: 500 });
    }

    if (!pendingReferrals || pendingReferrals.length === 0) {
      await finishCronRun(claim.id, 'succeeded', 'no pending referrals');
      return NextResponse.json({ message: 'No Pending Referrals To Fulfil', rewarded: 0 });
    }

    const rewarded: string[] = [];
    const failed: string[] = [];

    for (const ref of pendingReferrals) {
      const amt = Number(ref.referrer_reward_amount) || 0;
      if (amt <= 0) continue;

      // Atomically mark as rewarded and credit the referrer's prepaid balance
      const { error: fulfillErr } = await supabase.rpc('fulfil_researcher_referral', {
        p_referral_id: ref.id,
      });

      if (fulfillErr) {
        console.error('[referrals-fulfil] fulfillment error for referral', ref.id, fulfillErr);
        failed.push(ref.id);
        continue;
      }

      rewarded.push(ref.id);
    }

    const summary = `rewarded ${rewarded.length}, failed ${failed.length}`;
    await finishCronRun(claim.id, failed.length > 0 ? 'failed' : 'succeeded', summary);
    return NextResponse.json({
      message: `Rewarded ${rewarded.length} Referral${rewarded.length !== 1 ? 's' : ''}`,
      rewarded: rewarded.length,
      failed: failed.length,
    });
  } catch (err) {
    console.error('[referrals-fulfil] unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected cron error' }, { status: 500 });
  }
}

