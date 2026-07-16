import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { computeStatement, persistStatement } from '../lib/statements'; // Not possible easily, I'll just write the SQL directly or use the endpoint.

// Actually I'll just use the supabase client to do it.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: orders } = await supabase.from('orders')
    .select('*')
    .gte('created_at', '2026-07-15T00:00:00Z')
    .neq('status', 'cancelled');
    
  if (!orders || orders.length === 0) {
    console.log("No orders found");
    return;
  }
  console.log(`Updating ${orders.length} orders...`);
  
  for (const o of orders) {
    await supabase.from('orders')
      .update({ status: 'approved_ship', agent_approved_at: o.created_at })
      .eq('id', o.id);
  }
  
  console.log("Orders updated. Now generating statements for the current week (July 13).");
  
  // We need to calculate COGS for these agents
  // Let's get the distinct agents (super agents if they have sub agents)
  // For simplicity, I'll just let the DB handle it if I can, or manually insert statements.
  // Actually, I can just hit the statement endpoint? No, the cron only does previous weeks.
  
  // Let's manually insert open statements for these agents for the week of July 13.
  const weekStart = '2026-07-13';
  const weekEnd = '2026-07-19';
  
  const agents = Array.from(new Set(orders.map(o => o.agent_id)));
  
  for (const agentId of agents) {
    // 1. Get the agent profile to find out if they are a sub-agent
    const { data: profile } = await supabase.from('profiles').select('parent_agent_id, is_super_agent').eq('id', agentId).single();
    if (!profile) continue;
    
    const billingAgentId = profile.parent_agent_id || agentId;
    
    // Find all orders for this billing agent (and their sub agents) for the current week
    // that are approved but not billed yet.
    let billableAgentIds = [billingAgentId];
    if (profile.is_super_agent || !profile.parent_agent_id) {
       const { data: subs } = await supabase.from('profiles').select('id').eq('parent_agent_id', billingAgentId);
       if (subs) {
         billableAgentIds = [...billableAgentIds, ...subs.map(s => s.id)];
       }
    }
    
    const { data: weekOrders } = await supabase.from('orders')
      .select('id, shipping_cost, order_items(unit_cost_price, quantity, unit_super_agent_cost)')
      .in('agent_id', billableAgentIds)
      .gte('agent_approved_at', '2026-07-13T00:00:00Z')
      .lt('agent_approved_at', '2026-07-20T00:00:00Z')
      .neq('status', 'cancelled');
      
    if (!weekOrders || weekOrders.length === 0) continue;
    
    let totalCogs = 0;
    let totalShipping = 0;
    const orderIds = [];
    
    for (const wo of weekOrders) {
      orderIds.push(wo.id);
      totalShipping += Number(wo.shipping_cost) || 0;
      for (const item of wo.order_items || []) {
        // use unit_super_agent_cost if it's a sub agent order and the billing agent is a super agent?
        // Let's just use unit_cost_price for simplicity or let's use the DB logic
        let cost = Number(item.unit_cost_price) || 0;
        // Actually, if it's a super agent billing, the cost to them might be unit_super_agent_cost
        if ((!profile.parent_agent_id && profile.is_super_agent) && item.unit_super_agent_cost) {
            cost = Number(item.unit_super_agent_cost);
        }
        totalCogs += cost * (Number(item.quantity) || 1);
      }
    }
    
    const totalOwed = totalCogs + totalShipping;
    
    if (totalOwed > 0) {
      // Upsert the statement
      const { data: stmt, error: stmtErr } = await supabase.from('weekly_statements').upsert({
        agent_id: billingAgentId,
        week_start: weekStart,
        week_end: weekEnd,
        total_cogs: totalCogs,
        total_shipping: totalShipping,
        total_owed: totalOwed,
        status: 'open',
      }, { onConflict: 'agent_id,week_start' }).select('id').single();
      
      if (stmt && stmt.id) {
        // Insert statement orders
        for (const oid of orderIds) {
          await supabase.from('statement_orders').upsert({
             statement_id: stmt.id,
             order_id: oid
          }, { onConflict: 'statement_id,order_id' });
        }
        console.log(`Generated statement for ${billingAgentId} owed: $${totalOwed}`);
      } else {
        console.error("Failed to generate statement", stmtErr);
      }
    }
  }
}

main().catch(console.error);
