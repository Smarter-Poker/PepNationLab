import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: adamProfile } = await supabase.from('profiles').select('*').eq('full_name', 'Adam Donnahue').single();
  const { data: joeyProfile } = await supabase.from('profiles').select('*').eq('full_name', 'Joey').single();
  const { data: lisaProfile } = await supabase.from('profiles').select('*').eq('full_name', 'Lisa Anderson').single();
  const { data: researchers } = await supabase.from('profiles').select('*').eq('role', 'researcher').limit(1);
  const { data: product } = await supabase.from('products').select('id, name, base_cost').limit(1).single();

  if (!adamProfile || !joeyProfile || !lisaProfile || !product || !researchers || researchers.length === 0) {
    console.error("Missing necessary data to generate orders.");
    return;
  }

  const researcherId = researchers[0].id;

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

  console.log("Generating today's sales...");
  await generateOrder(joeyProfile.id, 1297, 0);
  await generateOrder(lisaProfile.id, 241, 0);

  console.log("Generating backdated sales...");
  let remaining = 11209;
  const numRandomOrders = 15;
  const agents = [adamProfile.id, joeyProfile.id, lisaProfile.id];
  
  for (let i = 0; i < numRandomOrders; i++) {
    let amount = Math.floor(Math.random() * 1000) + 200;
    if (i === numRandomOrders - 1) {
      amount = remaining;
    } else {
      const maxAllowed = remaining - (numRandomOrders - i - 1) * 100;
      amount = Math.min(amount, maxAllowed);
      if (amount < 50) amount = 50;
    }
    remaining -= amount;

    const daysAgo = Math.floor(Math.random() * 16) + 1; // 1 to 16 days ago
    const agentId = agents[Math.floor(Math.random() * agents.length)];
    
    await generateOrder(agentId, amount, daysAgo);
  }

  console.log("Finished generating fake orders.");
}

main().catch(console.error);
