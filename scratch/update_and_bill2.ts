import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// I will just fix my logic for billableAgentIds
async function main() {
  const { data: orders } = await supabase.from('orders')
    .select('id, agent_id')
    .gte('created_at', '2026-07-15T00:00:00Z')
    .neq('status', 'cancelled');
    
  if (!orders || orders.length === 0) return;
  
  const agents = Array.from(new Set(orders.map(o => o.agent_id)));
  const billingAgentIds = new Set<string>();
  
  for (const agentId of agents) {
    const { data: p } = await supabase.from('profiles').select('parent_agent_id').eq('id', agentId).single();
    if (p) billingAgentIds.add(p.parent_agent_id || agentId);
  }
  
  for (const billingAgentId of Array.from(billingAgentIds)) {
    // get billing agent profile
    const { data: billingProfile } = await supabase.from('profiles').select('account_type, is_super_agent').eq('id', billingAgentId).single();
    if (billingProfile?.account_type === 'prepaid') {
      console.log(`Skipping prepaid agent ${billingAgentId}`);
      continue;
    }
    
    let billableAgentIds = [billingAgentId];
    if (billingProfile?.is_super_agent) {
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
        let cost = Number(item.unit_cost_price) || 0;
        if (billingProfile?.is_super_agent && item.unit_super_agent_cost) {
            cost = Number(item.unit_super_agent_cost);
        }
        totalCogs += cost * (Number(item.quantity) || 1);
      }
    }
    
    const totalOwed = totalCogs + totalShipping;
    
    if (totalOwed > 0) {
      const { data: stmt, error: stmtErr } = await supabase.from('weekly_statements').upsert({
        agent_id: billingAgentId,
        week_start: '2026-07-13',
        week_end: '2026-07-19',
        total_cogs: totalCogs,
        total_shipping: totalShipping,
        total_owed: totalOwed,
        status: 'open',
      }, { onConflict: 'agent_id,week_start' }).select('id').single();
      
      if (stmt && stmt.id) {
        for (const oid of orderIds) {
          await supabase.from('statement_orders').upsert({
             statement_id: stmt.id,
             order_id: oid
          }, { onConflict: 'statement_id,order_id' });
        }
        console.log(`Generated/Updated statement for ${billingAgentId} owed: $${totalOwed}`);
      } else {
        console.error("Failed to generate statement", stmtErr);
      }
    }
  }
}

main().catch(console.error);
