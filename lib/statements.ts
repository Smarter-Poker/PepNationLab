import { createServiceClient } from '@/lib/supabase/server';
import { chicagoMidnightIso } from '@/lib/time-cst';

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export interface ComputeResult {
  weekEnd: string;
  totalCogs: number;
  totalShipping: number;
  totalOwed: number;
  orderIds: string[];
}

export async function computeStatement(
  supabase: ServiceClient,
  agentId: string,
  weekStart: string
): Promise<{ ok: true; data: ComputeResult } | { ok: false; error: string }> {
  const weekEnd = addDays(weekStart, 6);
  // Billing weeks live in America/Chicago. Mon 00:00 CT -> next Mon 00:00 CT
  // - matches the spec ("Week ends Sunday 23:59:59 CST") and handles DST.
  const rangeStart = chicagoMidnightIso(weekStart);
  const rangeEndExclusive = chicagoMidnightIso(addDays(weekStart, 7));

  const { data: agent, error: agentError } = await supabase
    .from('profiles')
    .select('tier, is_super_agent, parent_agent_id, account_type')
    .eq('id', agentId)
    .single();

  if (agentError || !agent) {
    return { ok: false, error: 'Agent Profile Not Found.' };
  }

  if (agent.account_type === 'prepaid') {
    return { ok: false, error: 'Cannot generate weekly statements for prepaid accounts. Their orders are billed at checkout.' };
  }

  if (agent.parent_agent_id) {
    return { ok: false, error: 'Sub-Agents do not generate Admin statements. Their Super Agent is billed.' };
  }

  let billableAgentIds = [agentId];

  if (agent.is_super_agent) {
    const { data: subAgents } = await supabase
      .from('profiles')
      .select('id')
      .eq('parent_agent_id', agentId);
    if (subAgents) {
      billableAgentIds = [...billableAgentIds, ...subAgents.map(sa => sa.id)];
    }
  }

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, agent_id, shipping_cost, order_items(quantity, unit_cost_price, unit_super_agent_cost)')
    .in('agent_id', billableAgentIds)
    .neq('status', 'cancelled')
    .neq('status', 'pending_customer_payment')
    .neq('status', 'agent_approval_pending')
    .gte('created_at', rangeStart)
    .lt('created_at', rangeEndExclusive);

  if (ordersError) {
    return { ok: false, error: ordersError.message };
  }

  let totalCogs = 0;
  let totalShipping = 0;
  const orderIds: string[] = [];

  for (const order of orders ?? []) {
    orderIds.push(order.id as string);
    totalShipping += Number(order.shipping_cost) || 0;

    const items = (order.order_items as unknown) as Array<{
      quantity: number;
      unit_cost_price: number | null;
      unit_super_agent_cost: number | null;
    }>;

    for (const item of items ?? []) {
      const qty = Number(item.quantity) || 0;

      if (order.agent_id === agentId) {
        totalCogs += (Number(item.unit_cost_price) || 0) * qty;
      } else {
        // Super-agent statement covers a sub-agent's order. Legacy rows can
        // have a NULL unit_super_agent_cost - fall back to unit_cost_price
        // (the order's snapshot of the agent's own cost) instead of $0 so we
        // never under-bill historical orders.
        const superCost = Number(item.unit_super_agent_cost);
        const agentCost = Number(item.unit_cost_price);
        const effective = Number.isFinite(superCost) && superCost > 0
          ? superCost
          : Number.isFinite(agentCost) && agentCost > 0
            ? agentCost
            : 0;
        totalCogs += effective * qty;
      }
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  totalCogs = round(totalCogs);
  totalShipping = round(totalShipping);

  return {
    ok: true,
    data: {
      weekEnd,
      totalCogs,
      totalShipping,
      totalOwed: round(totalCogs + totalShipping),
      orderIds,
    },
  };
}

export interface PersistOptions {
  force?: boolean;
}

export async function persistStatement(
  supabase: ServiceClient,
  agentId: string,
  weekStart: string,
  computed: ComputeResult,
  options: PersistOptions = {}
): Promise<
  | { ok: true; statementId: string; skipped?: false }
  | { ok: true; statementId: string; skipped: true; reason: 'paid' }
  | { ok: false; error: string }
> {
  // Refuse to overwrite a paid statement - even when force=true. A paid
  // statement is settled history; regenerating it would silently roll back
  // the agent's balance and corrupt the ledger.
  const { data: existing } = await supabase
    .from('weekly_statements')
    .select('id, status')
    .eq('agent_id', agentId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (existing?.status === 'paid') {
    return {
      ok: true,
      statementId: existing.id as string,
      skipped: true,
      reason: 'paid',
    };
  }

  // If we found a non-paid row, always let the upsert proceed so totals
  // are refreshed for the same week (regardless of force flag).

  // A $0 statement has nothing to collect — close it immediately so it never
  // appears as "outstanding" in the admin panel, wallet, or any balance query.
  const isZeroBalance = computed.totalOwed <= 0;
  const upsertPayload: Record<string, unknown> = {
    agent_id: agentId,
    week_start: weekStart,
    week_end: computed.weekEnd,
    total_cogs: computed.totalCogs,
    total_shipping: computed.totalShipping,
    total_owed: computed.totalOwed,
    status: isZeroBalance ? 'paid' : 'pending_payment',
  };
  if (isZeroBalance) {
    upsertPayload.paid_at = new Date().toISOString();
    upsertPayload.payment_method = 'zero_balance';
    upsertPayload.payment_reference = 'Auto-closed: no balance due';
  }

  const { data: statement, error: upsertError } = await supabase
    .from('weekly_statements')
    .upsert(upsertPayload, { onConflict: 'agent_id,week_start' })
    .select('id')
    .single();

  if (upsertError || !statement) {
    return { ok: false, error: upsertError?.message ?? 'Failed To Save Statement.' };
  }

  const { error: deleteError } = await supabase.from('statement_orders').delete().eq('statement_id', statement.id);
  if (deleteError) {
    console.error('[statements] failed to clear old statement_orders:', deleteError);
    return { ok: false, error: 'Failed To Clear Old Order Links.' };
  }

  if (computed.orderIds.length > 0) {
    const { error: insertError } = await supabase.from('statement_orders').insert(
      computed.orderIds.map((orderId) => ({
        statement_id: statement.id,
        order_id: orderId,
      }))
    );
    if (insertError) {
      console.error('[statements] failed to insert statement_orders:', insertError);
      return { ok: false, error: 'Failed To Link Orders To Statement.' };
    }
  }

  return { ok: true, statementId: statement.id };
}
