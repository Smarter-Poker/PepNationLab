const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const tomId = '3c7df977-500d-4d93-9603-66b57ca81494';
  const { data: tom } = await supabase.from('profiles').select('*').eq('id', tomId).single();
  
  const { data: products } = await supabase.from('products').select('*').limit(20);
  
  console.log("Adding favorites...");
  for (let i = 0; i < 5; i++) {
     const res = await supabase.from('researcher_favorites').upsert({ user_id: tom.id, product_id: products[i].id });
     if (res.error) console.error("Fav err", res.error);
  }
  
  console.log("Adding recently viewed...");
  for (let i = 5; i < 12; i++) {
     const res = await supabase.from('researcher_recently_viewed').upsert({ 
       user_id: tom.id, 
       product_id: products[i].id, 
       agent_id: tom.referring_agent_id 
     });
     if (res.error) console.error("Rec err", res.error);
  }

  console.log("Adding another past order...");
  const orderRes = await supabase.from('orders').insert({
    buyer_id: tom.id,
    agent_id: tom.referring_agent_id,
    total: 200.00,
    subtotal: 200.00,
    status: 'delivered',
    fulfillment_method: 'ship',
    payment_method: 'zelle'
  }).select();
  
  if (orderRes.error) {
    console.error("Order error:", orderRes.error);
  } else {
    const order = orderRes.data[0];
    await supabase.from('order_items').insert([
      { order_id: order.id, product_id: products[0].id, quantity: 2, price: 100.00, subtotal: 200 },
    ]);
  }
  console.log("Successfully seeded user data!");
}

run();
