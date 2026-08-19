import type { createServiceClient } from '@/lib/supabase/server';
import { computeStatement, persistStatement, computeDownlineInvoice } from '@/lib/statements';
import { chicagoMidnightIso } from '@/lib/time-cst';
import { notifyAdmins } from '@/lib/notify';
import { logError } from '@/lib/log';

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const round = (n: number) => Math.round(n * 100) / 100;

export interface RecomputeOutcome {
  /** Statements whose total_owed was corrected downward. */
  corrected: Array<{ statementId: string; from: number; to: number }>;
  /** Paid statements that could not be altered; a credit was recorded instead. */
  creditsRecorded: Array<{ statementId: string; amount: number }>;
  /** Unpaid invoices whose total was corrected. */
  invoicesCorrected: Array<{ invoiceId: string; from: number; to: number }>;
  /** Non-fatal problems. The caller's cancel is already committed either way. */
  errors: string[];
}

/**
 * Re-settle the weekly billing that a now-cancelled order was already rolled
 * into.
 *
 * THE BUG THIS FIXES: weekly_statements.total_owed is a hard SNAPSHOT written
 * by the Monday cron, and statement_orders rows are never revisited. Cancel an
 * order after that Monday and nothing anywhere recomputed the bill - the agent
 * was still charged for it, pay_invoice enforced the stale figure to the cent
 * (`amount_mismatch` if they paid a penny less), and get_statement_detail
 * cheerfully rendered a line item reading "cancelled" inside an invoice they
 * were required to pay in full. The cron could not repair it either: it claims
 * one run per week and skips any agent who already has a row, and the admin
 * "generate" action hard-refuses to touch an existing week.
 *
 * Safe to call more than once for the same order - it recomputes from live
 * data rather than applying a delta, and the credit record is keyed uniquely
 * on (statement_id, order_id).
 *
 * NEVER RAISES. Every caller invokes this immediately after a committed
 * cancel; throwing here would make a successful cancel look like a failure.
 */
export async function recomputeBillingForCancelledOrder(
  supabase: ServiceClient,
  orderId: string,
  actorId?: string | null
): Promise<RecomputeOutcome> {
  const outcome: RecomputeOutcome = {
    corrected: [],
    creditsRecorded: [],
    invoicesCorrected: [],
    errors: [],
  };

  try {
    // Which statements claimed this order? statement_orders is the only link -
    // there is no orders.statement_id column, and the week cannot be derived
    // from created_at because billing keys on agent_approved_at.
    const { data: links, error: linkErr } = await supabase
      .from('statement_orders')
      .select('statement_id')
      .eq('order_id', orderId);

    if (linkErr) {
      outcome.errors.push(`statement_orders lookup: ${linkErr.message}`);
    }

    const statementIds = Array.from(
      new Set((links ?? []).map((l: { statement_id: string }) => l.statement_id))
    );

    for (const statementId of statementIds) {
      const { data: stmt } = await supabase
        .from('weekly_statements')
        .select('id, agent_id, week_start, status, total_owed')
        .eq('id', statementId)
        .maybeSingle();

      if (!stmt) continue;

      const storedTotal = Number(stmt.total_owed) || 0;

      // A PAID statement is settled history. Rewriting it would silently roll
      // back the agent's ledger, and pay_invoice has already moved the money.
      // Record what they are owed instead and put it in front of an admin.
      if (stmt.status === 'paid') {
        const credit = await recordStatementCredit(
          supabase,
          statementId,
          orderId,
          stmt.agent_id as string,
          actorId ?? null
        );
        if (credit.ok && credit.amount > 0) {
          outcome.creditsRecorded.push({ statementId, amount: credit.amount });
        } else if (!credit.ok) {
          outcome.errors.push(`credit for ${statementId}: ${credit.error}`);
        }
        continue;
      }

      const computed = await computeStatement(
        supabase,
        stmt.agent_id as string,
        stmt.week_start as string
      );
      if (!computed.ok) {
        outcome.errors.push(`recompute ${statementId}: ${computed.error}`);
        continue;
      }

      // A cancellation must never make a bill go UP. computeStatement re-reads
      // the whole week, so in principle it could sweep in an order that landed
      // in this week after the statement was cut. Leaving the total alone in
      // that case is the conservative choice: the worst outcome is that we
      // under-bill by an amount that was never billed before this cancel
      // either, and the reconcile cron surfaces it rather than a researcher's
      // cancellation quietly raising their agent's invoice.
      if (round(computed.data.totalOwed) > round(storedTotal)) {
        outcome.errors.push(
          `recompute ${statementId} would raise total ${storedTotal} -> ${computed.data.totalOwed}; left unchanged`
        );
        continue;
      }

      const saved = await persistStatement(
        supabase,
        stmt.agent_id as string,
        stmt.week_start as string,
        computed.data
      );

      if (!saved.ok) {
        outcome.errors.push(`persist ${statementId}: ${saved.error}`);
        continue;
      }

      if (round(computed.data.totalOwed) !== round(storedTotal)) {
        outcome.corrected.push({
          statementId,
          from: storedTotal,
          to: computed.data.totalOwed,
        });

        // A dispute filed over a line that no longer exists is resolved.
        await supabase
          .from('weekly_statements')
          .update({ disputed_at: null, dispute_reason: null })
          .eq('id', statementId)
          .not('disputed_at', 'is', null);
      }
    }

    // The hop-by-hop side. agent_invoices has no order join table, so the
    // affected invoice is located by (agent, billing week) instead.
    await recomputeInvoiceForOrder(supabase, orderId, outcome);

    // Prepaid debits are not reversed by policy. Make sure they are at least
    // SEEN - see flagPrepaidDebitOnCancel.
    await flagPrepaidDebitOnCancel(supabase, orderId, outcome);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outcome.errors.push(message);
    logError('statement-recompute.cancel', { orderId }, err);
  }

  return outcome;
}

/**
 * The downline invoice covering this order's week, if any. Unlike statements
 * there is no join table, so we reconstruct the week from the order's own
 * billing timestamp (agent_approved_at, created_at fallback - the same key
 * the biller uses) and correct that week's unpaid invoice in place.
 */
async function recomputeInvoiceForOrder(
  supabase: ServiceClient,
  orderId: string,
  outcome: RecomputeOutcome
): Promise<void> {
  const { data: order } = await supabase
    .from('orders')
    .select('id, agent_id, agent_approved_at, created_at')
    .eq('id', orderId)
    .maybeSingle();

  if (!order?.agent_id) return;

  const { data: agent } = await supabase
    .from('profiles')
    .select('id, parent_agent_id, account_type, is_super_agent')
    .eq('id', order.agent_id as string)
    .maybeSingle();

  // Only parented accounts are invoiced by an upline; top-level agents are
  // handled by the weekly_statements branch above.
  if (!agent?.parent_agent_id) return;

  const billedAt = (order.agent_approved_at as string | null) ?? (order.created_at as string | null);
  if (!billedAt) return;

  const weekStart = chicagoWeekStartForInstant(new Date(billedAt));

  const { data: invoice } = await supabase
    .from('agent_invoices')
    .select('id, status, total_owed')
    .eq('agent_id', agent.id as string)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (!invoice) return;

  // Same rule as statements: paid is settled history.
  if (invoice.status === 'paid') return;

  const storedTotal = Number(invoice.total_owed) || 0;
  const totals = await computeDownlineInvoice(
    supabase,
    {
      id: agent.id as string,
      parent_agent_id: agent.parent_agent_id as string,
      account_type: agent.account_type as string | null,
      is_super_agent: agent.is_super_agent as boolean | null,
    },
    {
      rangeStart: chicagoMidnightIso(weekStart),
      rangeEndExclusive: chicagoMidnightIso(addDays(weekStart, 7)),
    }
  );

  if (round(totals.totalOwed) > round(storedTotal)) return; // never raise on a cancel
  if (round(totals.totalOwed) === round(storedTotal)) return;

  const { error: updErr } = await supabase
    .from('agent_invoices')
    .update({
      total_cogs: totals.totalCogs,
      total_shipping: totals.totalShipping,
      total_owed: totals.totalOwed,
      ...(totals.totalOwed <= 0 ? { status: 'paid', paid_at: new Date().toISOString() } : {}),
    })
    .eq('id', invoice.id as string)
    .neq('status', 'paid');

  if (updErr) {
    outcome.errors.push(`invoice ${invoice.id}: ${updErr.message}`);
    return;
  }

  outcome.invoicesCorrected.push({
    invoiceId: invoice.id as string,
    from: storedTotal,
    to: totals.totalOwed,
  });
}

/**
 * A prepaid account's order is debited from prepaid_balance at approval, and
 * reverse_order_credit_charge deliberately refuses to reverse it: prepaid
 * follows an explicit all-sales-final policy (credit accounts get their
 * headroom back, prepaid accounts do not).
 *
 * That policy is defensible when the BUYER walks away. It reads very
 * differently when the house or the agent cancels an order that never
 * shipped - the agent has then paid for goods they will never receive, and
 * nothing anywhere records it. refund_prepaid_balance exists but no cancel
 * path calls it and no screen surfaces the amount.
 *
 * This does NOT move money - changing a stated money policy is not a call to
 * make silently. It raises the debit so a human can decide, which is strictly
 * better than the previous behavior of losing it without trace.
 */
async function flagPrepaidDebitOnCancel(
  supabase: ServiceClient,
  orderId: string,
  outcome: RecomputeOutcome
): Promise<void> {
  const { data: charges } = await supabase
    .from('balance_transactions')
    .select('agent_id, amount, type')
    .eq('reference_id', orderId)
    .eq('type', 'order_charge');

  if (!charges || charges.length === 0) return;

  const agentId = charges[0].agent_id as string;
  const amount = round(
    charges.reduce((sum: number, c: { amount: unknown }) => sum + (Number(c.amount) || 0), 0)
  );
  if (amount <= 0) return;

  const { data: agent } = await supabase
    .from('profiles')
    .select('id, full_name, account_type')
    .eq('id', agentId)
    .maybeSingle();

  // Credit accounts are already handled by reverse_order_credit_charge.
  if (!agent || agent.account_type === 'credit') return;

  // Only raise it once per order. An 'adjustment' row tagged to this order is
  // the same marker the credit reversal uses for its own idempotency.
  const { data: alreadyFlagged } = await supabase
    .from('balance_transactions')
    .select('id')
    .eq('reference_id', orderId)
    .eq('agent_id', agentId)
    .eq('type', 'adjustment')
    .like('description', 'Prepaid Debit Flagged%')
    .maybeSingle();

  if (alreadyFlagged) return;

  const { error: markErr } = await supabase.from('balance_transactions').insert({
    agent_id: agentId,
    type: 'adjustment',
    amount: 0,
    description: `Prepaid Debit Flagged For Review On Cancelled Order ${orderId.slice(0, 8)} - $${amount.toFixed(2)} Debited, Not Refunded (All Sales Final)`,
    reference_id: orderId,
    reference_type: 'order',
  });

  if (markErr) {
    outcome.errors.push(`prepaid flag ${orderId}: ${markErr.message}`);
    return;
  }

  await notifyAdmins(supabase, {
    type: 'system',
    title: 'Prepaid Order Cancelled - Refund Decision Needed',
    body:
      `${agent.full_name ?? 'An agent'} was debited $${amount.toFixed(2)} for order ${orderId.slice(0, 8)}, which has now been cancelled. ` +
      `Prepaid debits are all-sales-final and were NOT auto-refunded. Refund it or confirm the charge stands.`,
    url: `/admin/orders?highlight=${orderId}`,
  }).catch(() => { /* best-effort */ });
}

/**
 * Record money owed back to an agent for an order cancelled out of a statement
 * they have ALREADY paid. We do not touch the paid statement or move funds
 * automatically - a human decides whether that becomes a refund or a credit on
 * the next bill - but the amount is captured the moment it arises so it cannot
 * be silently lost, which is what happened before.
 */
async function recordStatementCredit(
  supabase: ServiceClient,
  statementId: string,
  orderId: string,
  agentId: string,
  actorId: string | null
): Promise<{ ok: true; amount: number } | { ok: false; error: string }> {
  // What this order actually contributed to that statement, on the same cost
  // basis the statement used.
  const { data: order } = await supabase
    .from('orders')
    .select('id, agent_id, order_items(quantity, unit_cost_price, unit_super_agent_cost, unit_house_cost)')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return { ok: false, error: 'order not found' };

  let amount = 0;
  const items = (order.order_items as unknown) as Array<{
    quantity: number;
    unit_cost_price: number | null;
    unit_super_agent_cost: number | null;
    unit_house_cost: number | null;
  }>;

  for (const item of items ?? []) {
    const qty = Number(item.quantity) || 0;
    if (order.agent_id === agentId) {
      amount += (Number(item.unit_cost_price) || 0) * qty;
    } else {
      const houseCost = Number(item.unit_house_cost);
      const superCost = Number(item.unit_super_agent_cost);
      const agentCost = Number(item.unit_cost_price);
      const effective = Number.isFinite(houseCost) && houseCost > 0
        ? houseCost
        : Number.isFinite(superCost) && superCost > 0
          ? superCost
          : Number.isFinite(agentCost) && agentCost > 0
            ? agentCost
            : 0;
      amount += effective * qty;
    }
  }

  amount = round(amount);
  if (amount <= 0) return { ok: true, amount: 0 };

  // Unique on (statement_id, order_id) so repeated calls are no-ops rather
  // than stacking duplicate credits.
  const { error: insertErr } = await supabase.from('statement_adjustments').insert({
    statement_id: statementId,
    order_id: orderId,
    agent_id: agentId,
    amount,
    kind: 'cancelled_order_credit',
    status: 'pending',
    reason: 'Order Cancelled After This Statement Was Paid',
    created_by: actorId,
  });

  if (insertErr) {
    // 23505 = already recorded. That is the idempotent path, not a failure.
    if ((insertErr as { code?: string }).code === '23505') {
      return { ok: true, amount: 0 };
    }
    return { ok: false, error: insertErr.message };
  }

  await notifyAdmins(supabase, {
    type: 'system',
    title: 'Credit Owed On A Paid Statement',
    body: `An order was cancelled after its statement was paid. $${amount.toFixed(2)} is owed back and needs to be refunded or applied to the next bill.`,
    url: `/admin/statements?highlight=${statementId}`,
  }).catch(() => { /* best-effort */ });

  return { ok: true, amount };
}

/**
 * The Chicago billing week (Monday, YYYY-MM-DD) that contains `instant`.
 * Mirrors currentWeekStartCst but for an arbitrary point in time rather than
 * now, so a historical order maps to the week it was actually billed in.
 */
export function chicagoWeekStartForInstant(instant: Date): string {
  const chiDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);

  const [y, m, d] = chiDay.split('-').map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12));
  const day = anchor.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  anchor.setUTCDate(anchor.getUTCDate() + diff);
  return anchor.toISOString().slice(0, 10);
}
