import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { sendEmail, weeklyStatementEmail } from '@/lib/email';

/**
 * Weekly agent billing statements.
 *
 * BILLING MODEL (documented assumption):
 * An agent owes Pep Nation Lab the wholesale cost of goods for every order
 * placed through them in a week, priced at the AGENT's own pricing tier
 * (base_cost x agent tier multiplier, with per-product overrides applied),
 * plus the shipping cost Pep Nation Lab fronted. Cancelled orders are
 * excluded. total_owed = total_cogs + total_shipping.
 *
 * This is intentionally isolated in computeStatement() so the formula can
 * be adjusted in one place if the settlement model changes.
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

async function computeStatement(
  supabase: ServiceClient,
  agentId: string,
  weekStart: string
): Promise<{ ok: true; data: ComputeResult } | { ok: false; error: string }> {
  const weekEnd = addDays(weekStart, 6);
  const rangeStart = `${weekStart}T00:00:00Z`;
  const rangeEndExclusive = `${addDays(weekStart, 7)}T00:00:00Z`;

  // Agent pricing tier
  const { data: agent, error: agentError } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', agentId)
    .single();
  if (agentError || !agent) {
    return { ok: false, error: 'Agent Profile Not Found.' };
  }
  const agentTier = agent.tier ?? 'tier_3';

  // Tier multipliers and per-product overrides for this agent's tier
  const { data: tiers } = await supabase.from('pricing_tiers').select('tier_name, multiplier');
  const tierMultiplier =
    Number(tiers?.find((t) => t.tier_name === agentTier)?.multiplier) || 7.0;

  const { data: overrides } = await supabase
    .from('product_tier_overrides')
    .select('product_id, custom_multiplier')
    .eq('tier_name', agentTier);
  const overrideMap: Record<string, number> = {};
  overrides?.forEach((o) => {
    overrideMap[o.product_id] = Number(o.custom_multiplier);
  });

  // Billable orders placed through this agent within the week
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, shipping_cost, order_items(quantity, product_id, products(base_cost))')
    .eq('agent_id', agentId)
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
      product_id: string | null;
      products: { base_cost: number } | null;
    }>;

    for (const item of items ?? []) {
      const baseCost = Number(item.products?.base_cost) || 0;
      const multiplier =
        (item.product_id ? overrideMap[item.product_id] : undefined) ?? tierMultiplier;
      totalCogs += baseCost * multiplier * (Number(item.quantity) || 0);
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

async function persistStatement(
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

    const computed = await computeStatement(supabase, agentId, weekStart);
    if (!computed.ok) {
      return NextResponse.json({ error: computed.error }, { status: 400 });
    }

    const saved = await persistStatement(supabase, agentId, weekStart, computed.data);
    if (!saved.ok) {
      return NextResponse.json({ error: saved.error }, { status: 500 });
    }

    // Notify the agent (non-blocking)
    try {
      const { data: agent } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', agentId)
        .single();
      if (agent?.email) {
        const tpl = weeklyStatementEmail({
          weekStart,
          weekEnd: computed.data.weekEnd,
          totalOwed: computed.data.totalOwed,
          paid: false,
        });
        await sendEmail({ to: agent.email, subject: tpl.subject, html: tpl.html });
      }
    } catch (emailError) {
      console.error('Statement Email Failed:', emailError);
    }

    return NextResponse.json({ success: true, statementId: saved.statementId });
  }

  if (action === 'mark_paid') {
    const { statementId, paymentMethod, paymentReference } = body;
    if (!statementId) {
      return NextResponse.json({ error: 'Statement ID Is Required.' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('weekly_statements')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: paymentMethod || null,
        payment_reference: paymentReference || null,
      })
      .eq('id', statementId)
      .select('week_start, week_end, total_owed, agent_id')
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { error: error?.message ?? 'Failed To Update Statement.' },
        { status: 500 }
      );
    }

    // Receipt email to the agent (non-blocking)
    try {
      const { data: agent } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', updated.agent_id)
        .single();
      if (agent?.email) {
        const tpl = weeklyStatementEmail({
          weekStart: String(updated.week_start),
          weekEnd: String(updated.week_end),
          totalOwed: Number(updated.total_owed),
          paid: true,
        });
        await sendEmail({ to: agent.email, subject: tpl.subject, html: tpl.html });
      }
    } catch (emailError) {
      console.error('Statement Paid Email Failed:', emailError);
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown Action.' }, { status: 400 });
}
