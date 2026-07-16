import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: researchers } = await supabase.from('profiles').select('id').eq('role', 'researcher').eq('full_name', 'Test Betsybuyer').limit(1);
  if (!researchers || researchers.length === 0) return;
  const researcherId = researchers[0].id;

  // Cleanup ALL orders for this test buyer that are not cancelled
  const { data: ordersToClean } = await supabase.from('orders')
    .select('id')
    .eq('buyer_id', researcherId)
    .neq('status', 'cancelled');
    
  if (ordersToClean && ordersToClean.length > 0) {
    const orderIds = ordersToClean.map(o => o.id);
    await supabase.from('statement_orders').delete().in('order_id', orderIds);
    await supabase.from('agent_storefront_events').delete().in('order_id', orderIds);
    await supabase.from('order_items').delete().in('order_id', orderIds);
    await supabase.from('orders').delete().in('id', orderIds);
    console.log(`Cleaned up ${orderIds.length} previous orders.`);
  }

  const { data: agentsData } = await supabase.from('profiles').select('id, parent_agent_id, tier').eq('role', 'agent').limit(50);
  if (!agentsData || agentsData.length < 8) return;
  
  agentsData.sort(() => 0.5 - Math.random());
  const random8Agents = agentsData.slice(0, 8);
  
  const { data: adamProfile } = await supabase.from('profiles').select('*').eq('full_name', 'Adam Donnahue').single();
  const { data: joeyProfile } = await supabase.from('profiles').select('*').eq('full_name', 'Joey').single();
  const { data: lisaProfile } = await supabase.from('profiles').select('*').eq('full_name', 'Lisa Anderson').single();
  
  const selectedAgentsMap = new Map();
  [adamProfile, joeyProfile, lisaProfile, ...random8Agents].forEach(a => {
     if (a && !selectedAgentsMap.has(a.id)) {
       selectedAgentsMap.set(a.id, a);
     }
  });
  
  const agentsPool = Array.from(selectedAgentsMap.values());

  const { data: products } = await supabase.from('products').select('id, name, base_cost');
  if (!products || products.length === 0) return;
  
  const tierMultipliers: Record<string, number> = {
     'tier_1': 2.5,
     'tier_2': 3.0,
     'tier_3': 3.5,
  };

  let globalRevenue = 0;
  let globalAgentProfit = 0;
  let globalHouseProfit = 0;
  
  const generatedOrders = [];

  const generateOrder = async (agent: any, amountLimit: number, daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(Math.floor(Math.random() * 8) + 10, Math.floor(Math.random() * 60), 0, 0);

    const product = products[Math.floor(Math.random() * products.length)];
    const baseCogPerVial = Number(product.base_cost) / 10;
    
    // Calculate pricing based on agent tier
    const multiplier = tierMultipliers[agent.tier || 'tier_3'] || 3.5;
    const unitWholesaleCost = baseCogPerVial * multiplier; // This is unit_cost_price
    const unitRetailPrice = baseCogPerVial * 5.0; // Agent sells at 5x base COG (retail)
    
    // We want the total retail to be <= amountLimit
    // Find max qty
    let qty = Math.floor(amountLimit / unitRetailPrice);
    if (qty < 1) qty = 1; 
    // Wait, if qty=1 exceeds limit, we just use 1. It might go slightly over the daily limit, but it's fine.
    
    const retailTotal = unitRetailPrice * qty;
    const wholesaleTotal = unitWholesaleCost * qty;
    const manufacturerCogTotal = baseCogPerVial * qty;

    const { data: order } = await supabase.from('orders').insert({
      buyer_id: researcherId,
      agent_id: agent.id,
      status: 'approved_ship',
      fulfillment_method: 'ship',
      payment_method: 'zelle',
      subtotal: retailTotal,
      total: retailTotal,
      created_at: d.toISOString(),
      updated_at: d.toISOString(),
      agent_approved_at: d.toISOString(),
    }).select('id').single();

    if (order) {
      await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        quantity: qty,
        unit_retail_price: unitRetailPrice,
        unit_cost_price: unitWholesaleCost, // AGENT WHOLESALE COST
        created_at: d.toISOString()
      });
      
      const agentProfit = retailTotal - wholesaleTotal;
      const houseProfit = wholesaleTotal - manufacturerCogTotal;
      
      globalRevenue += retailTotal;
      globalAgentProfit += agentProfit;
      globalHouseProfit += houseProfit;
      
      console.log(`Generated $${retailTotal.toFixed(2)} order for Agent ${agent.id} at ${d.toISOString()}`);
      return { 
        orderId: order.id, 
        agentId: agent.id, 
        retailTotal, 
        wholesaleTotal,
        date: d.toISOString() 
      };
    }
  };

  const daysArray: number[] = [];
  for (let i = 1; i <= 17; i++) daysArray.push(i);
  daysArray.sort(() => 0.5 - Math.random());
  const selectedDays = daysArray.slice(0, 14); // 14 days with sales

  const maxPerDay = 1500;
  
  for (let i = 0; i < 14; i++) {
    const daysAgo = selectedDays[i];
    
    // Let's generate 1-3 orders for this day, summing up to <= maxPerDay
    let dayRemaining = Math.floor(Math.random() * 800) + 400; // Random target for the day (400-1200)
    
    while(dayRemaining > 50) {
      const agent = agentsPool[Math.floor(Math.random() * agentsPool.length)];
      const res = await generateOrder(agent, dayRemaining, daysAgo);
      if(res) {
         generatedOrders.push(res);
         dayRemaining -= res.retailTotal;
      } else {
         break;
      }
    }
  }

  // Today specific target (Joey ~$1297, Lisa ~$241). 
  // We will pass the exact limit to the generator, which will approximate it based on unit price.
  const res1 = await generateOrder(joeyProfile, 1297, 0);
  const res2 = await generateOrder(lisaProfile, 241, 0);
  if(res1) generatedOrders.push(res1);
  if(res2) generatedOrders.push(res2);

  // Re-run statements for current week (>= July 13th)
  const weekStart = '2026-07-13';
  const weekEnd = '2026-07-19';
  const currentWeekOrders = generatedOrders.filter(o => o.date >= '2026-07-13T00:00:00Z');
  
  const agentsToBill = Array.from(new Set(currentWeekOrders.map(o => o.agentId)));
  
  for (const agentId of agentsToBill) {
    const { data: p } = await supabase.from('profiles').select('parent_agent_id, account_type').eq('id', agentId).single();
    if (p?.account_type === 'prepaid') continue;
    
    const billingId = p?.parent_agent_id || agentId;
    const { data: bp } = await supabase.from('profiles').select('account_type, is_super_agent').eq('id', billingId).single();
    if (bp?.account_type === 'prepaid') continue;
    
    let subIds = [billingId];
    if (bp?.is_super_agent) {
       const { data: subs } = await supabase.from('profiles').select('id').eq('parent_agent_id', billingId);
       if (subs) subIds = [...subIds, ...subs.map(s => s.id)];
    }
    
    const agentOrders = currentWeekOrders.filter(o => subIds.includes(o.agentId));
    if (agentOrders.length === 0) continue;
    
    const cogs = agentOrders.reduce((sum, o) => sum + o.wholesaleTotal, 0); // Owed is WHOLESALE cost
    
    const { data: stmt } = await supabase.from('weekly_statements').upsert({
      agent_id: billingId,
      week_start: weekStart,
      week_end: weekEnd,
      total_cogs: cogs,
      total_owed: cogs,
      status: 'open',
    }, { onConflict: 'agent_id,week_start' }).select('id').single();
    
    if (stmt) {
       for (const ao of agentOrders) {
         await supabase.from('statement_orders').upsert({
            statement_id: stmt.id,
            order_id: ao.orderId
         }, { onConflict: 'statement_id,order_id' });
       }
    }
  }

  console.log(`--- Metrics ---`);
  console.log(`Total Sales Revenue: $${globalRevenue.toFixed(2)}`);
  console.log(`Total Agent Profit: $${globalAgentProfit.toFixed(2)}`);
  console.log(`Total House Profit: $${globalHouseProfit.toFixed(2)}`);
}

main().catch(console.error);
