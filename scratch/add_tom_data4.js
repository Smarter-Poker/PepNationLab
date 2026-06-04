const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const tomId = '3c7df977-500d-4d93-9603-66b57ca81494';
  const { data: tom } = await supabase.from('profiles').select('*').eq('id', tomId).single();
  
  const { data: products } = await supabase.from('products').select('*').limit(20);
  
  const orderRes = await supabase.from('orders').insert({
    user_id: tom.id,
    agent_id: tom.referring_agent_id,
    total_amount: 350.00,
    status: 'completed',
    stripe_session_id: 'fake_sess_' + Date.now()
  }).select();
  
  if (orderRes.error) {
    console.error("Order error:", orderRes.error);
    return;
  }
  
  const order = orderRes.data[0];
  
  await supabase.from('order_items').insert([
    { order_id: order.id, product_id: products[12].id, quantity: 2, unit_price: 100.00 },
    { order_id: order.id, product_id: products[13].id, quantity: 1, unit_price: 150.00 },
    { order_id: order.id, product_id: products[12].id, quantity: 3, unit_price: 100.00 } // simulate repeat order
  ]);
  
  console.log("Successfully added dummy data!");
}

run();
