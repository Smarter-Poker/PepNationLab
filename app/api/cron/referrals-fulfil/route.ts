import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
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
    const supabase = createAdminClient();

    // ── Phase 0: expire stale applied codes ─────────────────────────────
    // apply_referral_code stamps expires_at (180 days). Sweep past-due rows so
    // they stop counting as "in flight" for the referee-reuse check.
    await supabase
      .from('researcher_referrals')
      .update({ status: 'expired' })
      .in('status', ['applied', 'qualifying'])
      .lt('expires_at', new Date().toISOString());

    // ── Phase 1: promote qualifying -> pending ──────────────────────────
    // apply_referral_code inserts rows as 'qualifying'. A referral qualifies
    // once the referee places their first order at or over the program's
    // min_order_total that has progressed past payment (approved or beyond).
    // Nothing else in the system performs this transition, so we do it here.
    const { data: settingsRow } = await supabase
      .from('referral_settings')
      .select('min_order_total, is_active')
      .eq('id', 1)
      .maybeSingle();
    const minOrderTotal = Number(settingsRow?.min_order_total) || 0;

    const QUALIFYING_ORDER_STATUSES = ['approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered'];
    let promoted = 0;

    if (settingsRow?.is_active !== false) {
      const { data: qualifyingRefs } = await supabase
        .from('researcher_referrals')
        .select('id, referee_id, applied_at')
        .eq('status', 'qualifying')
        .limit(500);

      for (const qref of qualifyingRefs ?? []) {
        if (!qref.referee_id) continue;
        const { data: order } = await supabase
          .from('orders')
          .select('id, total, created_at')
          .eq('buyer_id', qref.referee_id)
          .in('status', QUALIFYING_ORDER_STATUSES)
          .gte('total', minOrderTotal)
          .gte('created_at', qref.applied_at ?? '1970-01-01')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!order) continue;

        const { error: promoteErr } = await supabase
          .from('researcher_referrals')
          .update({ status: 'pending', qualifying_order_id: order.id })
          .eq('id', qref.id)
          .eq('status', 'qualifying');
        if (!promoteErr) promoted += 1;
      }
    }

    // ── Phase 2: fulfil pending referrals ───────────────────────────────
    const { data: pendingReferrals, error } = await supabase
      .from('researcher_referrals')
      .select('id, referrer_id, referrer_reward_amount, referee_reward_amount')
      .eq('status', 'pending')
      .not('qualifying_order_id', 'is', null);

    if (error) {
      console.error('[referrals-fulfil] fetch error:', error);
      await finishCronRun(claim.id, 'failed', `fetch error: ${error.message.slice(0, 200)}`);
      return NextResponse.json({ error: 'Failed to fetch pending referrals' }, { status: 500 });
    }

    if (!pendingReferrals || pendingReferrals.length === 0) {
      await finishCronRun(claim.id, 'succeeded', `promoted ${promoted}, no pending referrals`);
      return NextResponse.json({ message: 'No Pending Referrals To Fulfil', promoted, rewarded: 0 });
    }

    const rewarded: string[] = [];
    const failed: string[] = [];

    for (const ref of pendingReferrals) {
      const referrerAmt = Number(ref.referrer_reward_amount) || 0;
      const refereeAmt = Number(ref.referee_reward_amount) || 0;
      if (referrerAmt <= 0 && refereeAmt <= 0) continue;

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

    const summary = `promoted ${promoted}, rewarded ${rewarded.length}, failed ${failed.length}`;
    await finishCronRun(claim.id, failed.length > 0 ? 'failed' : 'succeeded', summary);
    return NextResponse.json({
      message: `Rewarded ${rewarded.length} Referral${rewarded.length !== 1 ? 's' : ''}`,
      promoted,
      rewarded: rewarded.length,
      failed: failed.length,
    });
  } catch (err) {
    console.error('[referrals-fulfil] unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected cron error' }, { status: 500 });
  }
}
