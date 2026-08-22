import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { notify, notifyAdmins } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// This job scans every open weekly_statements / agent_invoices row plus a
// Monday-only prepaid-acknowledgment sweep, each with a claim update + a
// notify call per row. Give it the same headroom as the other billing crons.
export const maxDuration = 300;

// Reused verbatim from lib/notify.ts#notifyInvoiceGenerated so the reminder
// deep-links to the same wallet tab agents already use to pay.
const WALLET_URL = '/dashboard/agent?tab=statements';
const ADMIN_STATEMENTS_URL = '/admin/statements';

function fmtUsd(n: number): string {
  return `$${(Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * GET /api/cron/settlement-reminders
 *
 * NEW RULE (2026-07-19): weekly credit statements/invoices are due Monday.
 * Anything not marked paid by 5 PM Chicago gets a push, repeating daily at
 * 5 PM Chicago until paid, escalating who is notified as the week drags on:
 *   Mon -> payer only
 *   Tue -> payer + payee (statements' payee is the platform; invoices' payee
 *          is the super agent)
 *   Wed+ -> payer + payee + admins
 * Orders/accounts are NEVER auto-cancelled or frozen here - notifications
 * only. On Mondays this job also nudges every upline with prepaid downline
 * orders still awaiting a payment-confirmation acknowledgment, since prepaid
 * downlines settle per order rather than via a weekly bill.
 *
 * The Vercel schedule fires this route at both 22:00 and 23:00 UTC (to
 * survive the CST/CDT flip); the Chicago-hour gate below makes only the
 * instance that lands at 5 PM Chicago actually do anything.
 */
export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const chicagoHour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false }).format(new Date())
  );
  if (chicagoHour !== 17) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not_5pm_chicago' });
  }

  const partition = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const claim = await claimCronRun('settlement_reminders', partition);
  if (!claim) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_ran', partition });
  }

  const chicagoWeekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short' }).format(new Date());
  const tier = chicagoWeekday === 'Mon' ? 1 : chicagoWeekday === 'Tue' ? 2 : 3;

  let statementsReminded = 0;
  let invoicesReminded = 0;
  let prepaidPromptsSent = 0;

  try {
    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();

    // --- STATEMENTS (top-level agents, payee = platform/admins) -----------
    const { data: statements } = await supabase
      .from('weekly_statements')
      .select('id, agent_id, week_start, total_owed, payment_reminder_count')
      .eq('status', 'pending_payment')
      .gt('total_owed', 0)
      .order('week_start', { ascending: true })
      .limit(300);

    const stmtRows = statements ?? [];

    for (const stmt of stmtRows) {
      try {
        const currentCount = Number(stmt.payment_reminder_count) || 0;
        // Claim-first: stamp the reminder BEFORE sending it so a crash mid-run
        // (which leaves the cron_runs row retryable) can never double-send.
        const { data: claimedRows } = await supabase
          .from('weekly_statements')
          .update({ payment_reminder_count: currentCount + 1, last_payment_reminder_at: nowIso })
          .eq('id', stmt.id)
          .eq('payment_reminder_count', currentCount)
          .select('id');
        if (!claimedRows || claimedRows.length === 0) continue;

        const total = Number(stmt.total_owed) || 0;
        await notify(supabase, {
          userId: stmt.agent_id,
          type: 'payment_reminder',
          title: `Weekly Statement Due: ${fmtUsd(total)}`,
          body: `Your Statement For The Week Of ${stmt.week_start} Is ${fmtUsd(total)}. Please Send Payment And Mark It Paid In Your Wallet.`,
          url: WALLET_URL,
        });
        statementsReminded++;
      } catch (err) {
        console.error('[settlement-reminders] statement reminder failed:', stmt.id, err);
      }
    }

    // Statements' payee IS the platform, so tier 2 and tier 3 both mean
    // "tell admins" - send the one aggregated ping starting at tier >= 2.
    if (tier >= 2 && stmtRows.length > 0) {
      try {
        const stmtTotal = stmtRows.reduce((s, r) => s + (Number(r.total_owed) || 0), 0);
        await notifyAdmins(supabase, {
          type: 'payment_reminder',
          title: `${stmtRows.length} Weekly Statements Unpaid`,
          body: `${stmtRows.length} Statements Totaling ${fmtUsd(stmtTotal)} Are Past The Monday 5 PM Deadline.`,
          url: ADMIN_STATEMENTS_URL,
        });
      } catch (err) {
        console.error('[settlement-reminders] statements admin aggregate failed:', err);
      }
    }

    // --- INVOICES (sub-agents, payee = super_agent_id) ---------------------
    const { data: invoices } = await supabase
      .from('agent_invoices')
      .select('id, agent_id, super_agent_id, week_start, total_owed, payment_reminder_count')
      .eq('status', 'open')
      .gt('total_owed', 0)
      .order('week_start', { ascending: true })
      .limit(500);

    const invRows = invoices ?? [];
    const bySuper = new Map<string, { count: number; total: number }>();

    for (const inv of invRows) {
      try {
        const currentCount = Number(inv.payment_reminder_count) || 0;
        const { data: claimedRows } = await supabase
          .from('agent_invoices')
          .update({ payment_reminder_count: currentCount + 1, last_payment_reminder_at: nowIso })
          .eq('id', inv.id)
          .eq('payment_reminder_count', currentCount)
          .select('id');
        if (claimedRows && claimedRows.length > 0) {
          const total = Number(inv.total_owed) || 0;
          await notify(supabase, {
            userId: inv.agent_id,
            type: 'payment_reminder',
            title: `Weekly Invoice Due: ${fmtUsd(total)}`,
            body: `Your Invoice To Your Super Agent For The Week Of ${inv.week_start} Is ${fmtUsd(total)}. Please Send Payment And Mark It Paid In Your Wallet.`,
            url: WALLET_URL,
          });
          invoicesReminded++;
        }
      } catch (err) {
        console.error('[settlement-reminders] invoice reminder failed:', inv.id, err);
      }

      if (inv.super_agent_id) {
        const g = bySuper.get(inv.super_agent_id) ?? { count: 0, total: 0 };
        g.count += 1;
        g.total += Number(inv.total_owed) || 0;
        bySuper.set(inv.super_agent_id, g);
      }
    }

    if (tier >= 2) {
      for (const [superId, g] of bySuper) {
        try {
          await notify(supabase, {
            userId: superId,
            type: 'payment_reminder',
            title: `${g.count} Downline Invoices Unpaid`,
            body: `${g.count} Downline Invoices Totaling ${fmtUsd(g.total)} Are Past The Monday 5 PM Deadline.`,
            url: WALLET_URL,
          });
        } catch (err) {
          console.error('[settlement-reminders] super-agent aggregate failed:', superId, err);
        }
      }
    }

    if (tier >= 3 && invRows.length > 0) {
      try {
        const invTotal = invRows.reduce((s, r) => s + (Number(r.total_owed) || 0), 0);
        await notifyAdmins(supabase, {
          type: 'payment_reminder',
          title: `${invRows.length} Downline Invoices Unpaid`,
          body: `${invRows.length} Downline Invoices Totaling ${fmtUsd(invTotal)} Are Past The Monday 5 PM Deadline.`,
          url: ADMIN_STATEMENTS_URL,
        });
      } catch (err) {
        console.error('[settlement-reminders] invoices admin aggregate failed:', err);
      }
    }

    // --- MONDAY ONLY: prepaid downline payment-confirmation prompts -------
    if (tier === 1) {
      try {
        const { data: prepaidDownlines } = await supabase
          .from('profiles')
          .select('id, parent_agent_id')
          .eq('account_type', 'prepaid')
          .not('parent_agent_id', 'is', null);

        const prepaidRows = prepaidDownlines ?? [];
        const prepaidIds = prepaidRows.map((p) => p.id);

        if (prepaidIds.length > 0) {
          const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const { data: unconfirmedOrders } = await supabase
            .from('orders')
            .select('id, agent_id')
            .in('agent_id', prepaidIds)
            .in('status', ['approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered'])
            // Upline settlement acknowledgment moved to its own column
            // (2026-08-18); payment_confirmed_at is the buyer-payment
            // confirmation and counting it here nudged uplines about orders
            // they could never actually confirm.
            .is('upline_payment_confirmed_at', null)
            .gt('created_at', thirtyDaysAgoIso)
            .limit(300);

          const parentByAgent = new Map(prepaidRows.map((p) => [p.id, p.parent_agent_id as string]));
          const byParent = new Map<string, number>();
          for (const o of unconfirmedOrders ?? []) {
            const parentId = parentByAgent.get(o.agent_id);
            if (!parentId) continue;
            byParent.set(parentId, (byParent.get(parentId) ?? 0) + 1);
          }

          for (const [parentId, count] of byParent) {
            try {
              await notify(supabase, {
                userId: parentId,
                type: 'payment_reminder',
                title: `${count} Downline Payments To Confirm`,
                body: `You Have ${count} Prepaid Downline Orders Awaiting Your Payment Confirmation. Open Your Orders To Confirm Each One.`,
                // The confirm buttons live on the ORDERS tab, not the wallet.
                url: '/dashboard/agent?tab=Orders',
              });
              prepaidPromptsSent++;
            } catch (err) {
              console.error('[settlement-reminders] prepaid ack prompt failed:', parentId, err);
            }
          }
        }
      } catch (err) {
        console.error('[settlement-reminders] prepaid ack sweep failed:', err);
      }
    }

    await finishCronRun(
      claim.id,
      'succeeded',
      `tier=${tier} statementsReminded=${statementsReminded} invoicesReminded=${invoicesReminded} prepaidPromptsSent=${prepaidPromptsSent}`
    );

    return NextResponse.json({
      success: true,
      partition,
      tier,
      statementsReminded,
      invoicesReminded,
      prepaidPromptsSent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Cron Settlement Reminders Error:', message);
    await finishCronRun(claim.id, 'failed', message.slice(0, 500));
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
