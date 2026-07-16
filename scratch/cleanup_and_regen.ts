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

  const { data: orders } = await supabase.from('orders').select('id').eq('buyer_id', researcherId).eq('status', 'delivered');
  if (orders && orders.length > 0) {
    const orderIds = orders.map(o => o.id);
    
    // Delete events first
    await supabase.from('agent_storefront_events').delete().in('order_id', orderIds);
    
    // Delete orders (order_items cascades)
    await supabase.from('orders').delete().in('id', orderIds);
    
    console.log(`Deleted ${orderIds.length} orders and their events.`);
  }

  // Now, fetch 8 random agents
  const { data: agentsData } = await supabase.from('profiles').select('id').eq('role', 'agent').limit(50);
  if (!agentsData || agentsData.length < 8) {
    console.error("Not enough agents found");
    return;
  }
  
  // Shuffle and pick 8 agents
  agentsData.sort(() => 0.5 - Math.random());
  const agents = agentsData.slice(0, 8).map(a => a.id);
  
  // We need 14 days out of the last 17 with sales.
  // We'll distribute the 11209 over these 14 days.
  const daysArray: number[] = [];
  for (let i = 1; i <= 17; i++) {
    daysArray.push(i);
  }
  daysArray.sort(() => 0.5 - Math.random());
  const selectedDays = daysArray.slice(0, 14);

  // Distribute 11209 into 14 chunks
  let remaining = 11209;
  const amounts: number[] = [];
  for (let i = 0; i < 14; i++) {
    if (i === 13) {
      amounts.push(remaining);
    } else {
      let maxAllowed = remaining - (13 - i) * 100;
      let amount = Math.floor(Math.random() * (maxAllowed - 100)) + 100;
      amounts.push(amount);
      remaining -= amount;
    }
  }

  const { data: product } = await supabase.from('products').select('id, name, base_cost').limit(1).single();
  if (!product) return;

  const generateOrder = async (agentId: string, amount: number, daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(Math.floor(Math.random() * 8) + 10, Math.floor(Math.random() * 60), 0, 0);

    const { data: order, error: orderErr } = await supabase.from('orders').insert({
      buyer_id: researcherId,
      agent_id: agentId,
      status: 'delivered',
      fulfillment_method: 'ship',
      payment_method: 'zelle',
      subtotal: amount,
      total: amount,
      created_at: d.toISOString(),
      updated_at: d.toISOString()
    }).select('id').single();

    if (orderErr || !order) {
      console.error("Order error", orderErr);
      return;
    }

    const { error: itemErr } = await supabase.from('order_items').insert({
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      unit_retail_price: amount,
      unit_cost_price: product.base_cost,
      created_at: d.toISOString()
    });

    if (itemErr) {
      console.error("Item error", itemErr);
    } else {
      console.log(`Generated $${amount} order for Agent ${agentId} at ${d.toISOString()}`);
    }
  };

  // Re-run the specific orders the user asked for TODAY
  // "create some temporary sales for today, under Adam, pick one of his subagents and create 1297 in sales for the day, and then add $241 in sales from Lisa Anderson for today"
  
  const { data: adamProfile } = await supabase.from('profiles').select('*').eq('full_name', 'Adam Donnahue').single();
  const { data: joeyProfile } = await supabase.from('profiles').select('*').eq('full_name', 'Joey').single();
  const { data: lisaProfile } = await supabase.from('profiles').select('*').eq('full_name', 'Lisa Anderson').single();
  
  console.log("Generating today's fixed sales...");
  await generateOrder(joeyProfile.id, 1297, 0);
  await generateOrder(lisaProfile.id, 241, 0);

  console.log("Generating backdated sales...");
  // Now loop over the 14 days and use a random agent from the 8 picked agents
  for (let i = 0; i < 14; i++) {
    const daysAgo = selectedDays[i];
    const amount = amounts[i];
    const agentId = agents[Math.floor(Math.random() * agents.length)];
    await generateOrder(agentId, amount, daysAgo);
  }

  console.log("Finished generating fake orders.");
}

main().catch(console.error);
