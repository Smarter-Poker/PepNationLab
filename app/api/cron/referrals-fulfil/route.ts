import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { notifyReferralReward } from '@/lib/notify';

export const dynamic = 'force-dynamic';

const BATCH_LIMIT = 500;

const ELIGIBLE_STATUSES = [
  'approved_ship',
  'approved_pickup',
  'in_fulfillment',
  'shipped',
  'delivered',
];

interface Referral {
  id: string;
  referrer_id: string;
  referee_id: string;
  applied_at: string;
  referrer_reward_amount: number | null;
  referee_reward_amount: number | null;
}

/**
 * Hourly cron — for every researcher_referrals row in 'qualifying' status,
 * search the referee's order history for the earliest non-restock order with
 * status IN ELIGIBLE_STATUSES whose total crosses the
 * configured minimum and whose created_at is after the referral applied_at.
 * If found, fulfil the reward (issues store credits to both parties) and
 * notify them in-app.
 *
 * Also sweeps past-expiry referrals into 'expired' state.
 */
export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partition = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const claim = await claimCronRun('referrals_fulfil', partition);
  if (!claim) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_ran_this_hour' });
  }

  const summary = {
    considered: 0,
    rewarded: 0,
    expired: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    const service = await createServiceClient();

    const { data: settings } = await service
      .from('referral_settings')
      .select('min_order_total, is_active')
      .eq('id', 1)
      .maybeSingle();
    const minOrderTotal = Number(settings?.min_order_total ?? 100);
    const isActive = settings?.is_active !== false;

    // Sweep expired referrals first — even when paused, we still want to
    // age out stale qualifying rows.
    const { data: expiredRows } = await service
      .from('researcher_referrals')
      .update({ status: 'expired' })
      .eq('status', 'qualifying')
      .lt('expires_at', new Date().toISOString())
      .select('id');
    summary.expired = expiredRows?.length ?? 0;

    if (!isActive) {
      await finishCronRun(claim.id, 'succeeded', JSON.stringify({ ...summary, paused: true }));
      return NextResponse.json({ ok: true, ...summary, paused: true });
    }

    const { data: due, error: dueError } = await service
      .from('researcher_referrals')
      .select('id, referrer_id, referee_id, applied_at, referrer_reward_amount, referee_reward_amount')
      .eq('status', 'qualifying')
      .not('referee_id', 'is', null)
      .gt('expires_at', new Date().toISOString())
      .limit(BATCH_LIMIT);

    if (dueError) {
      await finishCronRun(claim.id, 'failed', dueError.message);
      return NextResponse.json({ ok: false, error: 'An unexpected error occurred.' }, { status: 500 });
    }

    const referrals = (due ?? []) as Referral[];
    summary.considered = referrals.length;

    for (const ref of referrals) {
      try {
        const { data: candidates } = await service
          .from('orders')
          .select('id, total, status, created_at, is_wholesale_restock')
          .eq('buyer_id', ref.referee_id)
          .in('status', ELIGIBLE_STATUSES)
          .eq('is_wholesale_restock', false)
          .gt('created_at', ref.applied_at)
          .order('created_at', { ascending: true })
          .limit(50);

        const qualifying = (candidates ?? []).find(
          (o) =>
            Number(o.total ?? 0) >= minOrderTotal,
        );
        if (!qualifying) {
          summary.skipped += 1;
          continue;
        }

        const { data: ok, error: fulfilError } = await service.rpc('fulfil_referral_reward', {
          p_referral_id: ref.id,
          p_qualifying_order_id: qualifying.id,
        });
        if (fulfilError || ok !== true) {
          summary.failed += 1;
          continue;
        }
        summary.rewarded += 1;

        // Notify both parties (best-effort, never throws).
        const referrerAmount = Number(ref.referrer_reward_amount ?? 0);
        const refereeAmount = Number(ref.referee_reward_amount ?? 0);
        try {
          await service.from('internal_messages').insert([
            {
              sender_id: ref.referrer_id,
              receiver_id: ref.referrer_id,
              subject: 'Referral Reward Earned',
              body: `Referral Reward Earned: $${referrerAmount.toFixed(2)} In Store Credit Added.`,
              type: 'notification',
            },
            {
              sender_id: ref.referee_id,
              receiver_id: ref.referee_id,
              subject: 'Welcome Bonus',
              body: `Welcome Bonus Earned: $${refereeAmount.toFixed(2)} In Store Credit Added.`,
              type: 'notification',
            },
          ]);
          // In-app notification — shows in bell immediately via Realtime
          await notifyReferralReward(service, ref.referrer_id, ref.referee_id, referrerAmount, refereeAmount);
        } catch {
          // notifications must not break the loop
        }
      } catch {
        summary.failed += 1;
      }
    }

    await finishCronRun(claim.id, 'succeeded', JSON.stringify(summary));
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    await finishCronRun(claim.id, 'failed', (err as Error)?.message ?? 'Unknown Error');
    return NextResponse.json({ ok: false, error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
