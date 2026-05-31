import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { computeSubAgentBaselineCost } from '@/lib/pricing';
import { assertSameOrigin } from '@/lib/csrf';
import { notifyInvoiceGenerated } from '@/lib/notify';

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
    const agentId = gate.user.id;

    // Verify caller is a Super Agent
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_agent')
      .eq('id', agentId)
      .single();

    let query = supabase
      .from('sub_agent_invoices')
      .select('*, profiles!sub_agent_invoices_sub_agent_id_fkey(full_name, email)')
      .order('week_start', { ascending: false });

    if (profile?.is_super_agent) {
      query = query.eq('super_agent_id', agentId);
    } else {
      query = query.eq('sub_agent_id', agentId);
    }

    const { data: invoices, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }

    return NextResponse.json({ data: invoices });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const superAgentId = gate.user.id;

    const body = await req.json();
    const { sub_agent_id, week_start, force } = body as {
      sub_agent_id?: string;
      week_start?: string;
      force?: boolean;
    };

    if (!sub_agent_id || !week_start) {
      return NextResponse.json({ error: 'sub_agent_id and week_start are required' }, { status: 400 });
    }

    // Verify caller is a Super Agent (or admin) — required to bypass paid invoices.
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('is_super_agent, role')
      .eq('id', superAgentId)
      .single();

    const callerIsAdmin = callerProfile?.role === 'admin';
    if (!callerProfile?.is_super_agent && !callerIsAdmin) {
      return NextResponse.json({ error: 'Only Super Agents can generate invoices' }, { status: 403 });
    }

    // Check if the Sub-Agent actually belongs to this Super Agent.
    const { data: subAgent } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', sub_agent_id)
      .eq('parent_agent_id', superAgentId)
      .single();

    if (!subAgent) {
      return NextResponse.json({ error: 'Sub-Agent not found or does not belong to you' }, { status: 404 });
    }

    // Never regenerate a paid invoice unless the requester is admin AND
    // explicitly opts in with force=true. A paid invoice is settled history;
    // overwriting it would silently revert the sub-agent's balance.
    const { data: existingInvoice } = await supabase
      .from('sub_agent_invoices')
      .select('id, status')
      .eq('sub_agent_id', sub_agent_id)
      .eq('week_start', week_start)
      .maybeSingle();

    if (existingInvoice?.status === 'paid') {
      if (!(force === true && callerIsAdmin)) {
        return NextResponse.json({
          skipped: true,
          reason: 'paid',
          invoiceId: existingInvoice.id,
        });
      }
    }

    const rangeStart = `${week_start}T00:00:00Z`;
    const weekEnd = addDays(week_start, 6);
    const rangeEndExclusive = `${addDays(week_start, 7)}T00:00:00Z`;

    // Fetch Sub-Agent orders for the week. Restock orders are sub-agent
    // self-buys that are billed at checkout, not via weekly invoice.
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, shipping_cost, order_items(product_id, quantity, unit_super_agent_cost, unit_cost_price)')
      .eq('agent_id', sub_agent_id)
      .neq('status', 'cancelled')
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEndExclusive);

    if (ordersError) {
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }

    let totalCogs = 0;
    let totalShipping = 0;

    for (const order of orders ?? []) {
      totalShipping += Number(order.shipping_cost) || 0;
      const items = (order.order_items as unknown) as Array<{
        product_id: string | null;
        quantity: number;
        unit_super_agent_cost: number | null;
        unit_cost_price: number | null;
      }>;

      for (const item of items ?? []) {
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) continue;

        // The sub-agent owes the super-agent the unit_cost_price (which the
        // super-agent sets as their baseline cost).
        const stored = Number(item.unit_cost_price);
        if (Number.isFinite(stored) && stored >= 0) {
          totalCogs += stored * qty;
        } else if (item.product_id) {
          const recomputed = await computeSubAgentBaselineCost(
            supabase,
            item.product_id,
            superAgentId
          );
          totalCogs += recomputed * qty;
        }
      }
    }

    // Sub-agents collected shipping at retail from customers. Since the Admin 
    // bills the Super Agent for this shipping cost on their weekly statement, 
    // the Super Agent MUST re-bill shipping to the Sub-Agent here, otherwise
    // the Super Agent loses money paying for the Sub-Agent's shipping.
    const cogsRound = Math.round(totalCogs * 100) / 100;
    const shippingRound = Math.round(totalShipping * 100) / 100;
    const totalOwed = Math.round((totalCogs + totalShipping) * 100) / 100;

    const { data: invoice, error: invoiceError } = await supabase
      .from('sub_agent_invoices')
      .upsert(
        {
          super_agent_id: superAgentId,
          sub_agent_id,
          week_start,
          week_end: weekEnd,
          total_cogs: cogsRound,
          total_shipping: shippingRound,
          total_owed: totalOwed,
          status: 'open',
          updated_at: new Date().toISOString()
        },
        { onConflict: 'sub_agent_id,week_start' }
      )
      .select('id')
      .single();

    if (invoiceError) {
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }

    // Auto-send internal message to sub-agent
    await supabase.from('internal_messages').insert({
      sender_id: superAgentId,
      receiver_id: sub_agent_id,
      subject: `Invoice For Week ${week_start}`,
      body: `Your invoice for the week of ${week_start} has been generated.\nTotal Owed: $${totalOwed.toFixed(2)}\n\nPlease review your dashboard to make payment.`,
      type: 'invoice'
    });

    // In-app notification — shows in bell immediately via Realtime
    void notifyInvoiceGenerated(supabase, sub_agent_id, week_start, totalOwed).catch(() => { /* best-effort */ });

    return NextResponse.json({ success: true, invoiceId: invoice.id });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
