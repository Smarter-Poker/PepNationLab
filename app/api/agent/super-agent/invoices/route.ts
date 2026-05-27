import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const superAgentId = gate.user.id;

    // Verify caller is a Super Agent
    const { data: superAgentProfile } = await supabase
      .from('profiles')
      .select('is_super_agent')
      .eq('id', superAgentId)
      .single();

    if (!superAgentProfile?.is_super_agent) {
      return NextResponse.json({ error: 'Only Super Agents can view Sub-Agent invoices' }, { status: 403 });
    }

    const { data: invoices, error } = await supabase
      .from('sub_agent_invoices')
      .select('*, profiles!sub_agent_invoices_sub_agent_id_fkey(full_name, email)')
      .eq('super_agent_id', superAgentId)
      .order('week_start', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: invoices });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const superAgentId = gate.user.id;

    const body = await req.json();
    const { sub_agent_id, week_start } = body;

    if (!sub_agent_id || !week_start) {
      return NextResponse.json({ error: 'sub_agent_id and week_start are required' }, { status: 400 });
    }

    // Verify caller is a Super Agent
    const { data: superAgentProfile } = await supabase
      .from('profiles')
      .select('is_super_agent')
      .eq('id', superAgentId)
      .single();

    if (!superAgentProfile?.is_super_agent) {
      return NextResponse.json({ error: 'Only Super Agents can generate invoices' }, { status: 403 });
    }

    // Check if the Sub-Agent actually belongs to this Super Agent
    const { data: subAgent } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', sub_agent_id)
      .eq('parent_agent_id', superAgentId)
      .single();

    if (!subAgent) {
      return NextResponse.json({ error: 'Sub-Agent not found or does not belong to you' }, { status: 404 });
    }

    const rangeStart = `${week_start}T00:00:00Z`;
    const weekEnd = addDays(week_start, 6);
    const rangeEndExclusive = `${addDays(week_start, 7)}T00:00:00Z`;

    // Fetch Sub-Agent orders for the week
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, shipping_cost, order_items(quantity, unit_cost_price)')
      .eq('agent_id', sub_agent_id)
      .neq('status', 'cancelled')
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEndExclusive);

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    let totalCogs = 0;
    let totalShipping = 0;

    for (const order of orders ?? []) {
      // Typically the Super Agent does NOT charge the Sub-Agent shipping again if Admin already charged the Super Agent,
      // but to mirror Admin behaviour, we can include shipping or just bill COGS.
      // Let's assume Sub-Agent pays their own COGS and Super Agent passes shipping down.
      totalShipping += Number(order.shipping_cost) || 0;

      const items = (order.order_items as unknown) as Array<{
        quantity: number;
        unit_cost_price: number | null;
      }>;

      for (const item of items ?? []) {
        totalCogs += (Number(item.unit_cost_price) || 0) * (Number(item.quantity) || 0);
      }
    }

    const totalOwed = totalCogs + totalShipping;

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('sub_agent_invoices')
      .upsert(
        {
          super_agent_id: superAgentId,
          sub_agent_id,
          week_start,
          week_end: weekEnd,
          total_cogs: totalCogs,
          total_owed: totalOwed,
          status: 'open',
          updated_at: new Date().toISOString()
        },
        { onConflict: 'sub_agent_id,week_start' }
      )
      .select('id')
      .single();

    if (invoiceError) {
      return NextResponse.json({ error: invoiceError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, invoiceId: invoice.id });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
