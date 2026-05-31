import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { computeStatement, persistStatement } from '@/lib/statements';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { computeSubAgentBaselineCost } from '@/lib/pricing';
import { notifyInvoiceGenerated } from '@/lib/notify';

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Snap the given date to the Monday of the *previous completed week*.
 * The cron runs late Sunday UTC; the week being billed is always the
 * week that just ended, so we subtract seven days from today first,
 * then back up to the Monday of that calendar week. Returns YYYY-MM-DD.
 */
function previousCompletedWeekStart(today: Date): string {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - 7);
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const today = new Date();
  const weekStart = previousCompletedWeekStart(today);

  // Idempotency: at most one successful weekly_invoices run per week_start.
  const claim = await claimCronRun('weekly_invoices', weekStart);
  if (!claim) {
    return NextResponse.json({ skipped: true, reason: 'already_ran', weekStart });
  }

  let statementsGenerated = 0;
  let invoicesGenerated = 0;
  let prepaidSkipped = 0;

  try {
    const supabase = await createServiceClient();

    // 1. Generate Admin Statements for all top-level Agents & Super Agents
    //    (parent_agent_id IS NULL — sub-agents are billed by their super
    //    agent, not by admin). Prepaid accounts are skipped: they were
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

        // Prevent double billing — skip if any row exists for this week.
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
          if (saved.ok) statementsGenerated++;
        }
      }
    }

    // 2. Generate Super Agent Invoices for all credit-billed Sub-Agents.
    //    Prepaid sub-agents are debited at approval time and need no invoice.
    const { data: subAgents, error: subAgentsError } = await supabase
      .from('profiles')
      .select('id, parent_agent_id, account_type')
      .eq('role', 'agent')
      .not('parent_agent_id', 'is', null);

    if (!subAgentsError && subAgents) {
      const rangeStart = `${weekStart}T00:00:00Z`;
      const weekEnd = addDays(weekStart, 6);
      const rangeEndExclusive = `${addDays(weekStart, 7)}T00:00:00Z`;

      for (const subAgent of subAgents) {
        if (subAgent.account_type === 'prepaid') {
          prepaidSkipped++;
          continue;
        }

        // Never overwrite an already-paid invoice.
        const { data: existingInvoice } = await supabase
          .from('sub_agent_invoices')
          .select('id, status')
          .eq('sub_agent_id', subAgent.id)
          .eq('week_start', weekStart)
          .maybeSingle();

        if (existingInvoice?.status === 'paid') continue;

        // Fetch Sub-Agent orders for the week.
        const { data: orders } = await supabase
          .from('orders')
          .select('id, shipping_cost, order_items(product_id, quantity, unit_super_agent_cost, unit_cost_price)')
          .eq('agent_id', subAgent.id)
          .neq('status', 'cancelled')
          .eq('is_wholesale_restock', false)
          .gte('created_at', rangeStart)
          .lt('created_at', rangeEndExclusive);

        let totalCogs = 0;

        for (const order of orders ?? []) {
          const items = (order.order_items as unknown) as Array<{
            product_id: string | null;
            quantity: number;
            unit_super_agent_cost: number | null;
            unit_cost_price: number | null;
          }>;

          for (const item of items ?? []) {
            const qty = Number(item.quantity) || 0;
            if (qty <= 0) continue;

            // Always price at the super-agent's wholesale cost: prefer the
            // historical snapshot from the order; fall back to the live
            // super_agent_pricing row; never reuse unit_cost_price (the
            // sub-agent's cost — the customer-side margin we do not bill).
            const stored = Number(item.unit_super_agent_cost);
            if (Number.isFinite(stored) && stored >= 0) {
              totalCogs += stored * qty;
            } else if (item.product_id && subAgent.parent_agent_id) {
              const recomputed = await computeSubAgentBaselineCost(
                supabase,
                item.product_id,
                subAgent.parent_agent_id
              );
              totalCogs += recomputed * qty;
            }
          }
        }

        // Sub-agents already collected shipping at retail from customers,
        // so the super-agent does NOT re-bill shipping here.
        const totalOwed = Math.round(totalCogs * 100) / 100;

        const { data: invoice } = await supabase
          .from('sub_agent_invoices')
          .upsert(
            {
              super_agent_id: subAgent.parent_agent_id,
              sub_agent_id: subAgent.id,
              week_start: weekStart,
              week_end: weekEnd,
              total_cogs: totalOwed,
              total_owed: totalOwed,
              status: 'open',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'sub_agent_id,week_start' }
          )
          .select('id')
          .single();

        if (invoice) {
          invoicesGenerated++;
          await supabase.from('internal_messages').insert({
            sender_id: subAgent.parent_agent_id,
            receiver_id: subAgent.id,
            subject: `Invoice For Week ${weekStart}`,
            body: `Your invoice for the week of ${weekStart} has been generated.\nTotal Owed: $${totalOwed.toFixed(2)}\n\nPlease review your dashboard to make payment.`,
            type: 'invoice',
          });
          // In-app notification — shows in bell immediately via Realtime
          void notifyInvoiceGenerated(supabase, subAgent.id, weekStart, totalOwed).catch(() => { /* best-effort */ });
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
