const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const tomId = '3c7df977-500d-4d93-9603-66b57ca81494';
  const { data: tom } = await supabase.from('profiles').select('*').eq('id', tomId).single();
  console.log("Using Tom:", tom.id);
  
  const { data: products } = await supabase.from('products').select('*').limit(20);
  
  console.log("Adding favorites...");
  for (let i = 0; i < 5; i++) {
     await supabase.from('researcher_favorites').upsert({ researcher_id: tom.id, product_id: products[i].id });
  }
  
  console.log("Adding recently viewed...");
  for (let i = 5; i < 12; i++) {
     await supabase.from('researcher_recently_viewed').upsert({ 
       researcher_id: tom.id, 
       product_id: products[i].id, 
       agent_id: tom.referring_agent_id 
     });
  }
  
  console.log("Adding past order...");
  const orderRes = await supabase.from('orders').insert({
    researcher_id: tom.id,
    agent_id: tom.referring_agent_id,
    total_amount: 350.00,
    status: 'completed',
    shipping_status: 'shipped',
    stripe_session_id: 'fake_sess_' + Date.now()
  }).select();
  
  if (orderRes.error) {
    console.error("Order error:", orderRes.error);
    return;
  }
  
  const order = orderRes.data[0];
  console.log("Order created:", order.id);
  
  await supabase.from('order_items').insert([
    { order_id: order.id, product_id: products[12].id, quantity: 2, unit_price: 100.00 },
    { order_id: order.id, product_id: products[13].id, quantity: 1, unit_price: 150.00 }
  ]);
  
  console.log("Successfully added dummy data!");
}

run();
