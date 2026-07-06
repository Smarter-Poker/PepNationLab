import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

/** GET a single sub-agent invoice with reconstructed line items for PDF rendering. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const { id } = await ctx.params;
    const supabase = await createServiceClient();
    const callerId = gate.user.id;

    // Caller must be a super_agent or admin.
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('is_super_agent, role')
      .eq('id', callerId)
      .maybeSingle();

    if (!callerProfile?.is_super_agent && callerProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: invoice, error } = await supabase
      .from('agent_invoices')
      .select(`*,
        agent:profiles!agent_id(full_name, email, username),
        super_agent:profiles!super_agent_id(full_name, email, username)`)
      .eq('id', id)
      .maybeSingle();

    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice Not Found' }, { status: 404 });
    }

    // Ownership: super_agent must own this invoice, OR admin can read any.
    if (callerProfile.role !== 'admin' && invoice.super_agent_id !== callerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Reconstruct line items: orders in invoice week_start..week_end for the sub-agent.
    const rangeStart = `${invoice.week_start}T00:00:00Z`;
    const d = new Date(`${invoice.week_start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    const rangeEndExclusive = d.toISOString();

    const { data: orders } = await supabase
      .from('orders')
      .select('id, created_at, shipping_cost, order_items(product_name, quantity, unit_super_agent_cost, unit_cost_price)')
      .eq('agent_id', invoice.agent_id)
      .neq('status', 'cancelled')
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEndExclusive);

    // Aggregate by product_name for a compact PDF table.
    const aggregated: Record<string, { product: string; qty: number; unitCost: number; lineTotal: number }> = {};
    for (const order of orders ?? []) {
      const items = (order.order_items as unknown) as Array<{
        product_name: string | null;
        quantity: number;
        unit_super_agent_cost: number | null;
        unit_cost_price: number | null;
      }>;
      for (const item of items ?? []) {
        const qty = Number(item.quantity) || 0;
        const unitCost = Number(item.unit_super_agent_cost) || 0;
        if (qty <= 0 || unitCost <= 0) continue;
        const key = (item.product_name || 'Unknown') + '|' + unitCost.toFixed(2);
        if (!aggregated[key]) {
          aggregated[key] = {
            product: item.product_name || 'Unknown',
            qty: 0,
            unitCost,
            lineTotal: 0,
          };
        }
        aggregated[key].qty += qty;
        aggregated[key].lineTotal += qty * unitCost;
      }
    }

    const lineItems = Object.values(aggregated).sort((a, b) => a.product.localeCompare(b.product));

    return NextResponse.json({ invoice, lineItems, orderCount: (orders ?? []).length });
  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
