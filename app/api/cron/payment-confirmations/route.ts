import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { notify } from '@/lib/notify';
import { emailConfigured, sendPaymentActionReminderEmail } from '@/lib/email';
import { shortOrderId } from '@/lib/push-enqueue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cron/payment-confirmations (hourly at :45)
 *
 * The 12-hour confirmation loop for the per-order payment chain:
 *
 *   buyer  - has not tapped "I Sent Payment"        (buyer_payment_sent_at)
 *   agent  - has not tapped "Did You Receive Payment?" (payment_confirmed_at)
 *   upline - prepaid downline's settlement unacknowledged
 *            (upline_payment_confirmed_at; only when the downline agent has
 *            an upline AND no credit line, i.e. account_type = 'prepaid')
 *
 * Each unconfirmed party is nudged (bell + push) every 12 hours until they
 * confirm, per-role, using per-role reminder clocks so the roles never
 * collide with each other or with the buyer-facing payment_reminder_count
 * used by /api/cron/reminders. Runs hourly; the 12h spacing lives in the
 * per-row clock check, so a missed hour never doubles anyone up.
 *
 * Buyer/agent nudges only apply to orders whose buyer pays per order
 * (credit-line buyers settle via weekly statements, no per-order payment
 * exists). Upline nudges only apply once the order is approved (that is when
 * the prepaid settlement actually happens).
 */

const TWELVE_HOURS_MS = 12 * 3600_000;
const LOOKBACK_DAYS = 45;

// Buyer + agent confirmations matter while the order is still moving toward
// (or through) fulfillment. Delivered orders keep nudging the AGENT only
// (money was owed regardless), but stop nudging the buyer.
const BUYER_AGENT_STATUSES = [
  'pending_customer_payment',
  'agent_approval_pending',
  'admin_approval_pending',
  'approved_ship',
  'approved_pickup',
  'in_fulfillment',
];
// Upline settlement acknowledgment applies once the order was approved.
const UPLINE_STATUSES = ['approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered'];

export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  // Hourly partition key; claimCronRun dedupes concurrent/retried firings.
  const partitionKey = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const claim = await claimCronRun('payment_confirmations', partitionKey);
  if (!claim) {
    return Response.json({ skipped: true, reason: 'already_ran_this_hour' });
  }

  let buyerNudges = 0;
  let agentNudges = 0;
  let uplineNudges = 0;
  let errorNote: string | null = null;

  try {
    const svc = createAdminClient();
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const cutoffIso = new Date(now - TWELVE_HOURS_MS).toISOString();
    const lookbackIso = new Date(now - LOOKBACK_DAYS * 24 * 3600_000).toISOString();

    const { data: orders, error: ordersErr } = await svc
      .from('orders')
      .select(`id, status, total, created_at, buyer_id, agent_id,
        buyer_payment_sent_at, payment_confirmed_at, upline_payment_confirmed_at,
        buyer_sent_reminder_at, agent_received_reminder_at, upline_received_reminder_at`)
      .in('status', [...new Set([...BUYER_AGENT_STATUSES, ...UPLINE_STATUSES])])
      // Only rows with at least one confirmation still missing: without this
      // filter, fully-confirmed shipped/delivered orders consumed the 500-row
      // cap and starved the newest unconfirmed orders of reminders.
      .or('payment_confirmed_at.is.null,buyer_payment_sent_at.is.null,upline_payment_confirmed_at.is.null')
      .gte('created_at', lookbackIso)
      .order('created_at', { ascending: true })
      .limit(500);
    if (ordersErr) throw new Error(`orders fetch: ${ordersErr.message}`);

    const rows = orders ?? [];

    // Batch the profile lookups: buyers (account_type) + agents (account_type,
    // parent_agent_id, full_name).
    const buyerIds = [...new Set(rows.map(o => o.buyer_id).filter((v): v is string => !!v))];
    const agentIds = [...new Set(rows.map(o => o.agent_id).filter((v): v is string => !!v))];
    const profileIds = [...new Set([...buyerIds, ...agentIds])];
    type ReminderProfile = { account_type: string | null; parent_agent_id: string | null; full_name: string | null; email: string | null; email_opt_out: boolean };
    const profileById = new Map<string, ReminderProfile>();
    const PROFILE_COLS = 'id, account_type, parent_agent_id, full_name, email, contact_email, email_verified, email_opt_out';
    const toReminderProfile = (p: any): ReminderProfile => ({
      account_type: p.account_type ?? null,
      parent_agent_id: p.parent_agent_id ?? null,
      full_name: p.full_name ?? null,
      email: (p.contact_email && p.email_verified ? p.contact_email : p.email) ?? null,
      email_opt_out: p.email_opt_out === true,
    });
    if (profileIds.length > 0) {
      const { data: profs } = await svc.from('profiles').select(PROFILE_COLS).in('id', profileIds);
      for (const p of profs ?? []) profileById.set(p.id, toReminderProfile(p));
    }

    // Push reach: recipients with no active push subscription get the same
    // reminder by EMAIL. Most staff accounts have never enabled push (see
    // /admin/push-health), so a push-only loop was invisible to them outside
    // the in-app bell. Same 12h cadence - the per-role clocks gate both.
    const uplineIds = [...new Set(
      rows
        .map((o) => (o.agent_id ? profileById.get(o.agent_id)?.parent_agent_id : null))
        .filter((v): v is string => !!v)
    )];
    const missingUplines = uplineIds.filter((id) => !profileById.has(id));
    if (missingUplines.length > 0) {
      const { data: ups } = await svc.from('profiles').select(PROFILE_COLS).in('id', missingUplines);
      for (const p of ups ?? []) profileById.set(p.id, toReminderProfile(p));
    }
    const pushReachable = new Set<string>();
    const allRecipientIds = [...new Set([...profileIds, ...uplineIds])];
    if (allRecipientIds.length > 0) {
      const { data: subs } = await svc
        .from('push_subscriptions')
        .select('user_id')
        .eq('is_active', true)
        .in('user_id', allRecipientIds);
      for (const su of subs ?? []) {
        if (su.user_id) pushReachable.add(su.user_id);
      }
    }

    const remind = async (userId: string, title: string, body: string, url: string) => {
      await notify(svc, { userId, type: 'payment_reminder', title, body, url });
      if (!pushReachable.has(userId) && emailConfigured()) {
        const prof = profileById.get(userId);
        if (prof?.email && !prof.email_opt_out) {
          await sendPaymentActionReminderEmail({
            to: prof.email,
            fullName: prof.full_name,
            title,
            bodyText: body,
            actionUrl: url,
            actionLabel: 'Open The Order',
          }).catch(() => {});
        }
      }
    };

    const due = (last: string | null, createdAt: string): boolean => {
      const anchor = last ?? createdAt;
      return anchor < cutoffIso;
    };

    for (const o of rows) {
      const short = shortOrderId(o.id);
      const total = Number(o.total) || 0;
      const totalFmt = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const buyer = o.buyer_id ? profileById.get(o.buyer_id) : null;
      const agent = o.agent_id ? profileById.get(o.agent_id) : null;
      // Credit-line buyers have no per-order payment to confirm.
      const buyerPaysPerOrder = !!o.buyer_id && buyer?.account_type !== 'credit';
      const inBuyerAgentWindow = BUYER_AGENT_STATUSES.includes(o.status);

      // ---- 1. Buyer: "Did You Send Payment?" ------------------------------
      if (
        inBuyerAgentWindow &&
        buyerPaysPerOrder &&
        !o.buyer_payment_sent_at &&
        due(o.buyer_sent_reminder_at, o.created_at)
      ) {
        // Claim the clock FIRST (CAS on the stale value) so a crashed run
        // never double-sends after restart.
        const { data: claimedRow } = await svc
          .from('orders')
          .update({ buyer_sent_reminder_at: nowIso })
          .eq('id', o.id)
          .is('buyer_payment_sent_at', null)
          .select('id');
        if (claimedRow && claimedRow.length > 0) {
          await remind(
            o.buyer_id as string,
            `Did You Send Payment? Order #${short}`,
            `Once You Have Sent ${totalFmt} To Your Agent, Tap "I Sent Payment" On The Order So It Can Be Processed.`,
            `/orders/${o.id}`,
          );
          buyerNudges++;
        }
      }

      // ---- 2. Agent: "Did You Receive Payment?" ---------------------------
      if (
        o.agent_id &&
        buyerPaysPerOrder &&
        !o.payment_confirmed_at &&
        (inBuyerAgentWindow || o.status === 'shipped' || o.status === 'delivered') &&
        due(o.agent_received_reminder_at, o.created_at)
      ) {
        const { data: claimedRow } = await svc
          .from('orders')
          .update({ agent_received_reminder_at: nowIso })
          .eq('id', o.id)
          .is('payment_confirmed_at', null)
          .select('id');
        if (claimedRow && claimedRow.length > 0) {
          const buyerSaysSent = !!o.buyer_payment_sent_at;
          await remind(
            o.agent_id,
            `Did You Receive Payment? Order #${short}`,
            buyerSaysSent
              ? `The Buyer Confirmed Sending ${totalFmt} For Order #${short}. Click Here To Go To The Order And Confirm Receipt So It Can Be Processed.`
              : `Order #${short} (${totalFmt}) Has No Confirmed Payment Yet. Click Here To Go To The Order And Confirm Receipt As Soon As The Buyer's Payment Lands.`,
            `/dashboard/agent?tab=Orders&order=${short}`,
          );
          agentNudges++;
        }
      }

      // ---- 3. Upline: prepaid downline settlement acknowledgment ----------
      const uplineId = agent?.parent_agent_id ?? null;
      if (
        uplineId &&
        agent?.account_type === 'prepaid' &&
        UPLINE_STATUSES.includes(o.status) &&
        !o.upline_payment_confirmed_at &&
        due(o.upline_received_reminder_at, o.created_at)
      ) {
        const { data: claimedRow } = await svc
          .from('orders')
          .update({ upline_received_reminder_at: nowIso })
          .eq('id', o.id)
          .is('upline_payment_confirmed_at', null)
          .select('id');
        if (claimedRow && claimedRow.length > 0) {
          await remind(
            uplineId,
            `Did You Receive Payment? Order #${short}`,
            `${agent?.full_name || 'Your Downline Agent'} Owes You ${totalFmt} For Order #${short}. Click Here To Go To The Order And Confirm Receipt.`,
            `/dashboard/agent?tab=Orders&order=${short}`,
          );
          uplineNudges++;
        }
      }
    }
  } catch (err: unknown) {
    errorNote = err instanceof Error ? err.message.slice(0, 300) : 'unknown_error';
  }

  const summary = `buyer=${buyerNudges} agent=${agentNudges} upline=${uplineNudges}${errorNote ? ` err=${errorNote}` : ''}`;
  await finishCronRun(claim.id, errorNote ? 'failed' : 'succeeded', summary);

  return Response.json({ ok: !errorNote, buyerNudges, agentNudges, uplineNudges, error: errorNote });
}
