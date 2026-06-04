const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const tomId = '3c7df977-500d-4d93-9603-66b57ca81494';
  const { data: tom } = await supabase.from('profiles').select('*').eq('id', tomId).single();
  
  const { data: products } = await supabase.from('products').select('*').limit(20);
  
  const orderRes = await supabase.from('orders').insert({
    buyer_id: tom.id,
    agent_id: tom.referring_agent_id,
    total: 350.00,
    subtotal: 350.00,
    status: 'completed',
    fulfillment_method: 'ship',
    payment_method: 'zelle'
  }).select();
  
  if (orderRes.error) {
    console.error("Order error:", orderRes.error);
    return;
  }
  
  const order = orderRes.data[0];
  console.log("Created order", order.id);
  
  await supabase.from('order_items').insert([
    { order_id: order.id, product_id: products[12].id, quantity: 2, price: 100.00, subtotal: 200 },
    { order_id: order.id, product_id: products[13].id, quantity: 1, price: 150.00, subtotal: 150 },
    { order_id: order.id, product_id: products[12].id, quantity: 3, price: 100.00, subtotal: 300 } // simulate repeat order
  ]);
  
  console.log("Successfully added dummy data!");
}

run();
