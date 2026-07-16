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
    await supabase.from('orders').delete().in('id', orderIds);
    console.log(`Cleaned up ${orderIds.length} orders.`);
  }

  const { data: agentsData } = await supabase.from('profiles').select('id, parent_agent_id').eq('role', 'agent').limit(50);
  if (!agentsData || agentsData.length < 8) return;
  
  agentsData.sort(() => 0.5 - Math.random());
  const random8Agents = agentsData.slice(0, 8).map(a => a.id);
  
  const { data: adamProfile } = await supabase.from('profiles').select('*').eq('full_name', 'Adam Donnahue').single();
  const { data: joeyProfile } = await supabase.from('profiles').select('*').eq('full_name', 'Joey').single();
  const { data: lisaProfile } = await supabase.from('profiles').select('*').eq('full_name', 'Lisa Anderson').single();
  const agentsPool = Array.from(new Set([adamProfile!.id, joeyProfile!.id, lisaProfile!.id, ...random8Agents]));

  const { data: products } = await supabase.from('products').select('id, name, base_cost');
  if (!products || products.length === 0) return;
  
  let totalRevenue = 0;
  let totalCogs = 0;

  const generateOrder = async (agentId: string, amount: number, daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(Math.floor(Math.random() * 8) + 10, Math.floor(Math.random() * 60), 0, 0);

    const product = products[Math.floor(Math.random() * products.length)];

    const { data: order } = await supabase.from('orders').insert({
      buyer_id: researcherId,
      agent_id: agentId,
      status: 'approved_ship',
      fulfillment_method: 'ship',
      payment_method: 'zelle',
      subtotal: amount,
      total: amount,
      created_at: d.toISOString(),
      updated_at: d.toISOString(),
      agent_approved_at: d.toISOString(),
    }).select('id').single();

    if (order) {
      await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_retail_price: amount,
        unit_cost_price: product.base_cost,
        created_at: d.toISOString()
      });
      totalRevenue += amount;
      totalCogs += Number(product.base_cost);
      console.log(`Generated $${amount} order for Agent ${agentId} at ${d.toISOString()}`);
      return { orderId: order.id, agentId, amount, cogs: Number(product.base_cost), date: d.toISOString() };
    }
  };

  const daysArray: number[] = [];
  for (let i = 1; i <= 17; i++) daysArray.push(i);
  daysArray.sort(() => 0.5 - Math.random());
  const selectedDays = daysArray.slice(0, 14); // 14 days with sales

  let remaining = 11209;
  const maxPerDay = 1500;
  
  // Allocate amounts to 14 days such that no day exceeds 1500
  const dailyAmounts: number[] = new Array(14).fill(0);
  
  // We need to distribute 11209 into 14 buckets, each max 1500.
  // We can initialize each with a base amount, then distribute the rest
  for (let i = 0; i < 14; i++) {
     dailyAmounts[i] = 100; // minimum 100
     remaining -= 100;
  }
  
  while(remaining > 0) {
     const idx = Math.floor(Math.random() * 14);
     if (dailyAmounts[idx] < maxPerDay) {
        const space = maxPerDay - dailyAmounts[idx];
        const add = Math.min(space, remaining, Math.floor(Math.random() * 400) + 100);
        dailyAmounts[idx] += add;
        remaining -= add;
     }
  }

  const generatedOrders = [];
  for (let i = 0; i < 14; i++) {
    const daysAgo = selectedDays[i];
    const amount = dailyAmounts[i];
    const agentId = agentsPool[Math.floor(Math.random() * agentsPool.length)];
    const res = await generateOrder(agentId, amount, daysAgo);
    if(res) generatedOrders.push(res);
  }

  const todayAmount1 = 1297;
  const todayAmount2 = 241;
  const res1 = await generateOrder(joeyProfile!.id, todayAmount1, 0);
  const res2 = await generateOrder(lisaProfile!.id, todayAmount2, 0);
  if(res1) generatedOrders.push(res1);
  if(res2) generatedOrders.push(res2);

  // Bill them by generating weekly statements
  // We only bill orders created >= Monday this week (July 13th)
  // Let's generate statements for all affected agents
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
    
    // Sum COGS
    const agentOrders = currentWeekOrders.filter(o => subIds.includes(o.agentId));
    if (agentOrders.length === 0) continue;
    
    const cogs = agentOrders.reduce((sum, o) => sum + o.cogs, 0);
    
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

  console.log(`Total Revenue: $${totalRevenue}`);
  console.log(`Total COGS: $${totalCogs}`);
  console.log(`Total Profit: $${totalRevenue - totalCogs}`);
}

main().catch(console.error);
