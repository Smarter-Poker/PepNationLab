import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!pendingReferrals || pendingReferrals.length === 0) {
      return NextResponse.json({ message: 'No Pending Referrals To Fulfil', rewarded: 0 });
    }

    const rewarded: string[] = [];
    const failed: string[] = [];

    for (const ref of pendingReferrals) {
      const amt = Number(ref.referrer_reward_amount) || 0;
      if (amt <= 0) continue;

      // Atomically credit the referrer's prepaid balance
      const { error: creditErr } = await supabase.rpc('credit_prepaid_balance', {
        p_user_id: ref.referrer_id,
        p_amount: amt,
        p_reference_id: ref.id,
        p_description: 'Referral Reward Credit',
      });

      if (creditErr) {
        console.error('[referrals-fulfil] balance credit error for referral', ref.id, creditErr);
        failed.push(ref.id);
        continue;
      }

      // Mark the referral as rewarded
      const { error: updErr } = await supabase
        .from('researcher_referrals')
        .update({ status: 'rewarded', rewarded_at: new Date().toISOString() })
        .eq('id', ref.id);

      if (updErr) {
        console.error('[referrals-fulfil] status update error for referral', ref.id, updErr);
        failed.push(ref.id);
        continue;
      }

      rewarded.push(ref.id);
    }

    return NextResponse.json({
      message: `Rewarded ${rewarded.length} Referral${rewarded.length !== 1 ? 's' : ''}`,
      rewarded: rewarded.length,
      failed: failed.length,
    });
  } catch (err) {
    console.error('[referrals-fulfil] unexpected error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
