import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { computeStatement, persistStatement, computeDownlineInvoice } from '@/lib/statements';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { notifyInvoiceGenerated } from '@/lib/notify';
import { chicagoMidnightIso, previousCompletedWeekStartCst } from '@/lib/time-cst';

// This job loops over every top-level agent and every credit downline, each with
// several sequential queries + RPCs. The default function budget can kill it
// mid-loop (leaving a stale 'running' claim + partial billing). Give it room; the
// per-agent work is idempotent (persistStatement skips paid, existing invoices are
// skipped) so a retry is safe, and claimCronRun can now re-take a stale/failed run.
export const maxDuration = 300;

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const today = new Date();
  // Bill weeks live in America/Chicago, not UTC, so the Monday we pick
  // here is the Monday in Chicago of the most-recently-completed week.
  const weekStart = previousCompletedWeekStartCst(today);

  // Idempotency: at most one successful weekly_invoices run per week_start.
  const claim = await claimCronRun('weekly_invoices', weekStart);
  if (!claim) {
    return NextResponse.json({ skipped: true, reason: 'already_ran', weekStart });
  }

  let statementsGenerated = 0;
  let invoicesGenerated = 0;
  let prepaidSkipped = 0;

  try {
    const supabase = createAdminClient();

    // 1. Generate Admin Statements for all top-level Agents & Super Agents
    //    (parent_agent_id IS NULL - downlines are billed by their upline,
    //    not by admin). Prepaid accounts are skipped: they were
    //    already debited atomically at order-approval time.
    const { data: adminBilledAgents, error: adminAgentsError } = await supabase
      .from('profiles')
      .select('id, account_type')
      .in('role', ['agent', 'super_agent'])
      .is('parent_agent_id', null);

    if (!adminAgentsError && adminBilledAgents) {
      for (const agent of adminBilledAgents) {
        if (agent.account_type === 'prepaid') {
          prepaidSkipped++;
          continue;
        }

        // Prevent double billing - skip if any row exists for this week.
        const { data: existingStmt } = await supabase
          .from('weekly_statements')
          .select('id, status')
          .eq('agent_id', agent.id)
          .eq('week_start', weekStart)
          .maybeSingle();

        if (existingStmt) continue;

        const computed = await computeStatement(supabase, agent.id, weekStart);
        if (computed.ok) {
          const saved = await persistStatement(supabase, agent.id, weekStart, computed.data);
          if (saved.ok) {
            statementsGenerated++;
            // Skip notify for $0 statements - pointless ping, common when an
            // agent had no activity that week.
            if (computed.data.totalOwed > 0) {
              await supabase.from('internal_messages').insert({
                sender_id: null,
                receiver_id: agent.id,
                subject: `Weekly Statement For ${weekStart}`,
                body: `Your weekly statement for the week of ${weekStart} has been generated.\nTotal Owed: $${computed.data.totalOwed.toFixed(2)}\n\nOpen your Wallet to review and pay.`,
                type: 'invoice',
              });
              await notifyInvoiceGenerated(supabase, agent.id, weekStart, computed.data.totalOwed)
                .catch(() => { /* best-effort */ });
            }
          }
        }
      }
    }

    // 2. Generate upline invoices for every credit-billed downline account -
    //    standard Agents AND nested Super Agents (role='super_agent' with a
    //    parent). This is the hop-by-hop half of the weekly trickle-down:
    //    each downline is invoiced by their DIRECT upline for (a) their own
    //    orders at their own cost and, for nested Supers, (b) their entire
    //    subtree's orders at the nested Super's cost basis - so a 3rd-level
    //    agent's COGS flows agent -> their super -> ... -> top-level super,
    //    whose Admin statement (part 1) carries it to the house.
    //    Prepaid downlines' OWN orders are debited at approval time and need
    //    no invoice - but a prepaid nested Super's subtree portion has no
    //    per-order settlement, so it is still invoiced weekly.
    const { data: downlineAgents, error: downlineAgentsError } = await supabase
      .from('profiles')
      .select('id, parent_agent_id, account_type, is_super_agent')
      .in('role', ['agent', 'super_agent'])
      .not('parent_agent_id', 'is', null);

    if (!downlineAgentsError && downlineAgents) {
      // CST/CDT-aware billing week. rangeStart = Mon 00:00 Chicago,
      // rangeEndExclusive = next Mon 00:00 Chicago - exactly the
      // "Mon -> Sun 23:59:59 CT" window the spec calls for.
      const rangeStart = chicagoMidnightIso(weekStart);
      const weekEnd = addDays(weekStart, 6);
      const rangeEndExclusive = chicagoMidnightIso(addDays(weekStart, 7));

      for (const downline of downlineAgents) {
        const isPrepaid = downline.account_type === 'prepaid';
        if (isPrepaid && !downline.is_super_agent) {
          prepaidSkipped++;
          continue;
        }

        // Never overwrite an already-paid invoice.
        const { data: existingInvoice } = await supabase
          .from('agent_invoices')
          .select('id, status')
          .eq('agent_id', downline.id)
          .eq('week_start', weekStart)
          .maybeSingle();

        if (existingInvoice?.status === 'paid') continue;

        // The per-downline math lives in lib/statements.ts so the wallet
        // forecast can project the exact number this cron will bill. It was
        // lifted verbatim from here; see computeDownlineInvoice.
        //
        //   (a) the downline's OWN orders - skipped for prepaid accounts,
        //       whose own orders settle per-order at approval time, and
        //   (b) for a nested Super Agent, their entire subtree at their own
        //       cost basis, which is what makes money trickle past hop one.
        const invoiceTotals = await computeDownlineInvoice(
          supabase,
          {
            id: downline.id as string,
            parent_agent_id: downline.parent_agent_id as string | null,
            account_type: downline.account_type as string | null,
            is_super_agent: downline.is_super_agent as boolean | null,
          },
          { rangeStart, rangeEndExclusive }
        );

        const cogsRound = invoiceTotals.totalCogs;
        const shippingRound = invoiceTotals.totalShipping;
        const totalOwed = invoiceTotals.totalOwed;

        // Skip $0 invoices.
        if (totalOwed <= 0) continue;

        const { data: invoiceId, error: invoiceErr } = await supabase.rpc('upsert_agent_invoice_atomic', {
          p_super_agent_id: downline.parent_agent_id,
          p_agent_id: downline.id,
          p_week_start: weekStart,
          p_week_end: weekEnd,
          p_total_cogs: cogsRound,
          p_total_shipping: shippingRound,
          p_total_owed: totalOwed,
        });

        if (invoiceErr) {
          console.error('[invoices-cron] invoice upsert failed for downline', downline.id, invoiceErr.message);
          continue;
        }

        if (invoiceId && !existingInvoice) {
          invoicesGenerated++;
          await supabase.from('internal_messages').insert({
            sender_id: downline.parent_agent_id,
            receiver_id: downline.id,
            subject: `Invoice For Week ${weekStart}`,
            body: `Your invoice for the week of ${weekStart} has been generated.\nTotal Owed: $${totalOwed.toFixed(2)}\n\nPlease review your dashboard to make payment.`,
            type: 'invoice',
          });
          await notifyInvoiceGenerated(supabase, downline.id, weekStart, totalOwed).catch(() => { /* best-effort */ });
        }
      }
    }

    await finishCronRun(
      claim.id,
      'succeeded',
      `weekStart=${weekStart} statements=${statementsGenerated} invoices=${invoicesGenerated} prepaidSkipped=${prepaidSkipped}`
    );

    return NextResponse.json({
      success: true,
      weekStart,
      statementsGenerated,
      invoicesGenerated,
      prepaidSkipped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Cron Invoices Error:', message);
    await finishCronRun(claim.id, 'failed', message.slice(0, 500));
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
