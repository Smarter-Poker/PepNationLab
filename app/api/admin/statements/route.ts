import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * Weekly agent billing statements.
 *
 * BILLING MODEL (Phase 8):
 * Super Agents are billed for their direct orders + sub-agent orders.
 * Sub-Agents are NEVER billed by Admin (they settle directly with their Super Agent).
 * Agents are billed for their direct orders.
 * We rely strictly on unit_cost_price and unit_super_agent_cost from order_items
 * as historical snapshots, rather than recalculating from base_cost.
 */

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

interface ComputeResult {
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
  const rangeStart = `${weekStart}T00:00:00Z`;
  const rangeEndExclusive = `${addDays(weekStart, 7)}T00:00:00Z`;

  // Check Agent profile
  const { data: agent, error: agentError } = await supabase
    .from('profiles')
    .select('tier, is_super_agent, parent_agent_id')
    .eq('id', agentId)
    .single();

  if (agentError || !agent) {
    return { ok: false, error: 'Agent Profile Not Found.' };
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

  // Billable orders placed through this agent (and sub-agents) within the week
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, agent_id, shipping_cost, order_items(quantity, unit_cost_price, unit_super_agent_cost)')
    .in('agent_id', billableAgentIds)
    .neq('status', 'cancelled')
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
        // Direct order. Agent/Super Agent owes their direct cost.
        totalCogs += (Number(item.unit_cost_price) || 0) * qty;
      } else {
        // Sub-Agent order. Super Agent owes their Super Agent cost.
        totalCogs += (Number(item.unit_super_agent_cost) || 0) * qty;
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

export async function persistStatement(
  supabase: ServiceClient,
  agentId: string,
  weekStart: string,
  computed: ComputeResult
): Promise<{ ok: true; statementId: string } | { ok: false; error: string }> {
  const { data: statement, error: upsertError } = await supabase
    .from('weekly_statements')
    .upsert(
      {
        agent_id: agentId,
        week_start: weekStart,
        week_end: computed.weekEnd,
        total_cogs: computed.totalCogs,
        total_shipping: computed.totalShipping,
        total_owed: computed.totalOwed,
        status: 'pending_payment',
      },
      { onConflict: 'agent_id,week_start' }
    )
    .select('id')
    .single();

  if (upsertError || !statement) {
    return { ok: false, error: upsertError?.message ?? 'Failed To Save Statement.' };
  }

  // Rebuild the order links for this statement
  await supabase.from('statement_orders').delete().eq('statement_id', statement.id);
  if (computed.orderIds.length > 0) {
    await supabase.from('statement_orders').insert(
      computed.orderIds.map((orderId) => ({
        statement_id: statement.id,
        order_id: orderId,
      }))
    );
  }

  // Retrieve current balance for ledger insertion
  const { data: profile } = await supabase.from('profiles').select('prepaid_balance').eq('id', agentId).single();
  const balanceBefore = Number(profile?.prepaid_balance) || 0;
  const balanceAfter = balanceBefore - computed.totalOwed;

  // Log the charge to the ledger
  await supabase.from('balance_transactions').insert({
    agent_id: agentId,
    type: 'order_charge',
    amount: computed.totalOwed,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    description: `Weekly Statement: ${weekStart}`,
    reference_id: statement.id,
    reference_type: 'statement'
  });

  // Update profile balance
  await supabase.from('profiles').update({ prepaid_balance: balanceAfter }).eq('id', agentId);

  return { ok: true, statementId: statement.id };
}

// GET: list all statements with agent info
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const status = req.nextUrl.searchParams.get('status');

  let dbQuery = supabase
    .from('weekly_statements')
    .select('*, profiles!weekly_statements_agent_id_fkey(full_name, email)')
    .order('week_start', { ascending: false });

  if (status) {
    dbQuery = dbQuery.eq('status', status);
  }

  const { data, error } = await dbQuery;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

// POST: generate a statement or mark one paid
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === 'generate') {
    const { agentId, weekStart } = body;
    if (!agentId || !weekStart) {
      return NextResponse.json(
        { error: 'Agent And Week Start Date Are Required.' },
        { status: 400 }
      );
    }

    // Check if statement already exists to prevent Double-Billing
    const { data: existingStmt } = await supabase
      .from('weekly_statements')
      .select('id')
      .eq('agent_id', agentId)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (existingStmt) {
      return NextResponse.json(
        { error: 'A statement for this week has already been generated. To prevent double-billing, you cannot regenerate it.' },
        { status: 400 }
      );
    }

    const computed = await computeStatement(supabase, agentId, weekStart);
    if (!computed.ok) {
      return NextResponse.json({ error: computed.error }, { status: 400 });
    }

    const saved = await persistStatement(supabase, agentId, weekStart, computed.data);
    if (!saved.ok) {
      return NextResponse.json({ error: saved.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, statementId: saved.statementId });
  }

  if (action === 'mark_paid') {
    const { statementId, paymentNotes } = body;
    if (!statementId) {
      return NextResponse.json({ error: 'Statement ID Required.' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('weekly_statements')
      .update({
        status: 'paid',
        payment_notes: paymentNotes || null,
        paid_at: new Date().toISOString(),
      })
      .eq('id', statementId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid Action' }, { status: 400 });
}
