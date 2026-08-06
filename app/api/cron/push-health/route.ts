import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { isWebPushConfigured } from '@/lib/web-push';
import { notify, notifyAdmins } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/push-health (daily, 13:00 UTC = 8am Chicago)
 *
 * Watchdog for the push pipeline, born from the 2026-08-04 incident: the
 * platform admin received zero mobile pushes for DAYS while every server-side
 * metric read "success". Root cause class: push services answer 2xx for
 * dead-but-unexpired subscriptions, so acceptance is not delivery, and nothing
 * in the system could tell the difference — or would ever alert anyone.
 *
 * Four checks, each alerting in-app (bell feed always lands even when push
 * itself is what broke):
 *
 *  1. ZOMBIE SUBSCRIPTIONS — active rows the push services keep ACCEPTING
 *     sends for (last_used_at fresh) that have not CONFIRMED a display via
 *     the /api/push/receipt beacon in 3+ days, despite having confirmed at
 *     least once before (so we know the device runs a receipt-capable service
 *     worker). Each owner is nudged to re-enable on that device; admins get
 *     the aggregate.
 *
 *  2. STAFF WITH NO ACTIVE SUBSCRIPTION — admins / agents / super agents who
 *     had pushes skipped with no_subscription in the last 7 days. These are
 *     the people orders and payment proofs escalate to; a silent phone here
 *     is revenue on the floor.
 *
 *  3. CONFIGURATION — VAPID env vars missing (every push silently skipped),
 *     or any web_push_not_configured skips in the last 24h.
 *
 *  4. DISPATCH LIVENESS — the every-5-minutes push-dispatch cron has not
 *     recorded a run in 30+ minutes (schedule dropped from vercel.json,
 *     deploy broke the route, CRON_SECRET drift, ...).
 */
export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const claim = await claimCronRun('push_health', partitionKey);
  if (!claim) {
    return Response.json({ skipped: true, reason: 'already_ran_today' });
  }

  const problems: string[] = [];
  let zombies = 0;
  let staffUnreachable = 0;
  let errorNote: string | null = null;

  try {
    const svc = createAdminClient();
    const now = Date.now();
    const d3 = new Date(now - 3 * 24 * 3600_000).toISOString();
    const d7 = new Date(now - 7 * 24 * 3600_000).toISOString();
    const h24 = new Date(now - 24 * 3600_000).toISOString();
    const m30 = new Date(now - 30 * 60_000).toISOString();

    // ── 1. Zombie subscriptions: accepted recently, no confirmed display. ──
    const { data: zombieSubs } = await svc
      .from('push_subscriptions')
      .select('id, user_id, device_label, user_agent, last_used_at, last_receipt_at')
      .eq('is_active', true)
      .gte('last_used_at', d3)
      .not('last_receipt_at', 'is', null)
      .lt('last_receipt_at', d3)
      .limit(200);

    const zombiesByUser = new Map<string, string[]>();
    for (const z of zombieSubs ?? []) {
      if (!z.user_id) continue;
      const ua = String(z.user_agent ?? '');
      const label = z.device_label && z.device_label !== 'MacIntel'
        ? String(z.device_label)
        : /iPhone|iPad/i.test(ua) ? 'iPhone'
        : /Android/i.test(ua) ? 'Android Device'
        : 'Computer';
      const list = zombiesByUser.get(z.user_id) ?? [];
      list.push(label);
      zombiesByUser.set(z.user_id, list);
      zombies++;
    }
    for (const [userId, labels] of zombiesByUser) {
      await notify(svc, {
        userId,
        type: 'system',
        title: 'Notifications May Not Be Reaching Your Device',
        body: `Pushes Sent To Your ${[...new Set(labels)].join(' And ')} Are Being Accepted But Never Displayed. Open Pep Nation Lab On That Device And Notifications Will Repair Automatically — Or Re-Enable Them Under Notification Preferences.`,
        url: '/account/notification-preferences',
        withPush: false, // push is exactly what's broken for this device
      });
    }
    if (zombies > 0) problems.push(`${zombies} zombie subscription(s) across ${zombiesByUser.size} user(s)`);

    // ── 2. Staff whose pushes are being skipped for having no device. ──────
    const { data: skippedRows } = await svc
      .from('push_outbox')
      .select('recipient_user_id')
      .eq('status', 'skipped')
      .eq('failure_reason', 'no_subscription')
      .gte('created_at', d7)
      .limit(1000);
    const skippedUserIds = [...new Set((skippedRows ?? [])
      .map((r: { recipient_user_id: string | null }) => r.recipient_user_id)
      .filter((v): v is string => !!v))];
    if (skippedUserIds.length > 0) {
      const { data: staff } = await svc
        .from('profiles')
        .select('id, full_name, role')
        .in('id', skippedUserIds)
        .in('role', ['admin', 'super_agent', 'agent']);
      staffUnreachable = (staff ?? []).length;
      for (const s of staff ?? []) {
        await notify(svc, {
          userId: s.id,
          type: 'system',
          title: 'Your Phone Is Not Receiving Order Alerts',
          body: 'This Account Has No Active Push Device, So Order And Payment Alerts From The Last 7 Days Only Reached Your In-App Bell. Open Pep Nation Lab On Your Phone And Tap Enable When Prompted, Or Turn Notifications On Under Notification Preferences.',
          url: '/account/notification-preferences',
          withPush: false,
        });
      }
      if (staffUnreachable > 0) {
        problems.push(`${staffUnreachable} staff account(s) with pushes skipped for no_subscription`);
      }
    }

    // ── 3. Configuration. ────────────────────────────────────────────
    if (!isWebPushConfigured()) {
      problems.push('VAPID env vars missing — EVERY push is being skipped');
    } else {
      const { count: cfgSkips } = await svc
        .from('push_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('failure_reason', 'web_push_not_configured')
        .gte('created_at', h24);
      if (cfgSkips) problems.push(`${cfgSkips} push(es) skipped as web_push_not_configured in 24h`);
    }

    // ── 4. Dispatch liveness. ──────────────────────────────────────────
    const { data: lastDispatch } = await svc
      .from('cron_runs')
      .select('started_at')
      .eq('job_name', 'push_dispatch')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastDispatch || lastDispatch.started_at < m30) {
      problems.push(
        `push-dispatch cron has not run since ${lastDispatch?.started_at ?? 'NEVER'} — pending pushes are not draining`
      );
    }

    // ── Aggregate alert to admins (in-app; the bell always lands). ─────────
    if (problems.length > 0) {
      await notifyAdmins(svc, {
        type: 'system',
        title: `Push Health: ${problems.length} Issue(s) Detected`,
        body: problems.join(' • ').slice(0, 490),
        url: '/admin',
      });
    }
  } catch (err: unknown) {
    errorNote = err instanceof Error ? err.message.slice(0, 300) : 'unknown_error';
  }

  const summary = `problems=${problems.length} zombies=${zombies} staffUnreachable=${staffUnreachable}${errorNote ? ` err=${errorNote}` : ''}`;
  await finishCronRun(claim.id, errorNote ? 'failed' : 'succeeded', summary);

  return Response.json({ ok: !errorNote, problems, zombies, staffUnreachable, error: errorNote });
}
