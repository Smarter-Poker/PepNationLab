import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { computeStatement, persistStatement } from '@/app/api/admin/statements/route';

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getPreviousMonday(d: Date): string {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  date.setUTCDate(diff);
  return date.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // The cron runs on Sunday night at 23:59.
    // The previous Monday is 6 days ago.
    const today = new Date();
    const weekStart = getPreviousMonday(today);

    // 1. Generate Admin Statements for all Agents & Super Agents
    const { data: adminBilledAgents, error: adminAgentsError } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['agent', 'super_agent'])
      .is('parent_agent_id', null);

    let statementsGenerated = 0;
    if (!adminAgentsError && adminBilledAgents) {
      for (const agent of adminBilledAgents) {
        // Prevent double billing
        const { data: existingStmt } = await supabase
          .from('weekly_statements')
          .select('id')
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

    // 2. Generate Super Agent Invoices for all Sub-Agents
    const { data: subAgents, error: subAgentsError } = await supabase
      .from('profiles')
      .select('id, parent_agent_id')
      .eq('role', 'agent')
      .not('parent_agent_id', 'is', null);

    let invoicesGenerated = 0;
    if (!subAgentsError && subAgents) {
      const rangeStart = `${weekStart}T00:00:00Z`;
      const weekEnd = addDays(weekStart, 6);
      const rangeEndExclusive = `${addDays(weekStart, 7)}T00:00:00Z`;

      for (const subAgent of subAgents) {
        // Fetch Sub-Agent orders for the week
        const { data: orders } = await supabase
          .from('orders')
          .select('id, shipping_cost, order_items(quantity, unit_cost_price)')
          .eq('agent_id', subAgent.id)
          .neq('status', 'cancelled')
          .gte('created_at', rangeStart)
          .lt('created_at', rangeEndExclusive);

        let totalCogs = 0;
        let totalShipping = 0;

        for (const order of orders ?? []) {
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
        const { data: invoice } = await supabase
          .from('sub_agent_invoices')
          .upsert(
            {
              super_agent_id: subAgent.parent_agent_id,
              sub_agent_id: subAgent.id,
              week_start: weekStart,
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

        if (invoice) {
          invoicesGenerated++;
          // Wait, 'messages' table or 'internal_messages' table?
          // Looking at the codebase, we used 'internal_messages'. Let's insert into 'internal_messages'
          await supabase.from('internal_messages').insert({
            sender_id: subAgent.parent_agent_id,
            receiver_id: subAgent.id,
            subject: `Invoice for Week ${weekStart}`,
            body: `Your invoice for the week of ${weekStart} has been generated.\nTotal Owed: $${totalOwed.toFixed(2)}\n\nPlease review your dashboard to make payment.`,
            type: 'invoice'
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      statementsGenerated,
      invoicesGenerated
    });

  } catch (error) {
    console.error('Cron Invoices Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
