import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { notifyAdmins } from '@/lib/notify';
import { shortOrderId } from '@/lib/push-enqueue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cron/payment-confirmation-health (daily, 13:30 UTC)
 *
 * Runtime watchdog for the payment-confirmation chain. The CI guard
 * (scripts/ci/payment-confirmation-guard.mjs) keeps the CODE honest at build
 * time; this keeps the SYSTEM honest in production. Three checks, each
 * alerting admins in-app (the bell always lands, even when push is broken):
 *
 *  1. SHIP-GATE BYPASS - a ship order released in the last 7 days whose
 *     per-order buyer never had payment confirmed. The route gate + DB
 *     trigger should make this impossible; a hit means something wrote
 *     around them (a new code path, a manual SQL update) and the hole
 *     needs closing, not just the order fixing.
 *
 *  2. REMINDER-LOOP LIVENESS - /api/cron/payment-confirmations must have
 *     recorded a run within the last 2 hours (it runs hourly). If it stops,
 *     every unconfirmed order goes silent exactly like the 2026-08-04 push
 *     outage: nothing looks broken, nobody gets nudged.
 *
 *  3. STUCK CONFIRMATIONS - orders older than 72h with a confirmation still
 *     missing (buyer sent / agent received / upline received). These are
 *     revenue sitting in limbo; the daily digest keeps them visible.
 */
export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = new Date().toISOString().slice(0, 10);
  const claim = await claimCronRun('payment_confirmation_health', partitionKey);
  if (!claim) {
    return Response.json({ skipped: true, reason: 'already_ran_today' });
  }

  const problems: string[] = [];
  let bypasses = 0;
  let stuck = 0;
  let errorNote: string | null = null;

  try {
    const svc = createAdminClient();
    const now = Date.now();
    const d7 = new Date(now - 7 * 24 * 3600_000).toISOString();
    const h72 = new Date(now - 72 * 3600_000).toISOString();
    const h2 = new Date(now - 2 * 3600_000).toISOString();

    // ---- 1. Ship-gate bypass detection -----------------------------------
    // Keyed on created_at (admin transitions never set agent_approved_at, so
    // keying on it made the canary blind to exactly the bypass paths it
    // exists to catch), scoped to ship-fulfillment orders (pickup is exempt
    // from the gate by design), and only orders created after the gate
    // deployed (older releases are history, not bypasses).
    const GATE_DEPLOYED_AT = '2026-08-18T23:00:00Z';
    const bypassSince = GATE_DEPLOYED_AT > d7 ? GATE_DEPLOYED_AT : d7;
    const { data: shipped } = await svc
      .from('orders')
      .select('id, buyer_id, payment_confirmed_at, status')
      .in('status', ['approved_ship', 'in_fulfillment', 'shipped'])
      .eq('fulfillment_method', 'ship')
      .is('payment_confirmed_at', null)
      .not('buyer_id', 'is', null)
      .gte('created_at', bypassSince)
      .limit(100);
    const shipRows = shipped ?? [];
    if (shipRows.length > 0) {
      const buyerIds = [...new Set(shipRows.map((o) => o.buyer_id).filter((v): v is string => !!v))];
      const { data: buyers } = await svc
        .from('profiles')
        .select('id, account_type')
        .in('id', buyerIds);
      const creditBuyers = new Set((buyers ?? []).filter((b) => b.account_type === 'credit').map((b) => b.id));
      const offenders = shipRows.filter((o) => o.buyer_id && !creditBuyers.has(o.buyer_id));
      bypasses = offenders.length;
      if (bypasses > 0) {
        const shorts = offenders.slice(0, 5).map((o) => `#${shortOrderId(o.id)}`).join(', ');
        problems.push(`${bypasses} ship order(s) released WITHOUT payment confirmation (${shorts}) - the ship gate was bypassed`);
      }
    }

    // ---- 2. Reminder-loop liveness ----------------------------------------
    const { data: lastRun } = await svc
      .from('cron_runs')
      .select('started_at')
      .eq('job_name', 'payment_confirmations')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastRun || lastRun.started_at < h2) {
      problems.push(
        `payment-confirmations reminder cron has not run since ${lastRun?.started_at ?? 'NEVER'} - unconfirmed orders are not being nudged`
      );
    }

    // ---- 3. Stuck confirmations digest ------------------------------------
    const { data: oldOrders } = await svc
      .from('orders')
      .select('id, status, buyer_id, agent_id, payment_confirmed_at, created_at')
      .in('status', ['pending_customer_payment', 'agent_approval_pending', 'admin_approval_pending', 'approved_ship', 'approved_pickup', 'in_fulfillment'])
      .lt('created_at', h72)
      .is('payment_confirmed_at', null)
      .not('buyer_id', 'is', null)
      .limit(200);
    // Exclude credit-line buyers (no per-order payment ever exists for them)
    // so the daily digest is signal, not permanent noise.
    const stuckRows = oldOrders ?? [];
    if (stuckRows.length > 0) {
      const stuckBuyerIds = [...new Set(stuckRows.map((o) => o.buyer_id).filter((v): v is string => !!v))];
      const { data: stuckBuyers } = await svc
        .from('profiles')
        .select('id, account_type')
        .in('id', stuckBuyerIds);
      const creditStuck = new Set((stuckBuyers ?? []).filter((b) => b.account_type === 'credit').map((b) => b.id));
      stuck = stuckRows.filter((o) => o.buyer_id && !creditStuck.has(o.buyer_id)).length;
    } else {
      stuck = 0;
    }
    if (stuck > 0) {
      problems.push(`${stuck} active order(s) older than 72h still have no payment-receipt confirmation`);
    }

    if (problems.length > 0) {
      await notifyAdmins(svc, {
        type: 'system',
        title: `Payment Confirmation Health: ${problems.length} Issue(s)`,
        body: problems.join(' • ').slice(0, 490),
        url: '/admin/orders',
      });
    }
  } catch (err: unknown) {
    errorNote = err instanceof Error ? err.message.slice(0, 300) : 'unknown_error';
  }

  const summary = `problems=${problems.length} bypasses=${bypasses} stuck=${stuck}${errorNote ? ` err=${errorNote}` : ''}`;
  await finishCronRun(claim.id, errorNote ? 'failed' : 'succeeded', summary);

  return Response.json({ ok: !errorNote, problems, bypasses, stuck, error: errorNote });
}
