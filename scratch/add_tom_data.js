const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: users, error } = await supabase.from('profiles').select('*').ilike('first_name', '%tom%');
  console.log("Users:", users);
  
  if (users && users.length > 0) {
    const tom = users.find(u => u.first_name.toLowerCase() === 'tom' && (u.last_name || '').toLowerCase() === 'gorczak') || users[0];
    console.log("Found Tom:", tom);
    
    // Get some products
    const { data: products } = await supabase.from('products').select('*').limit(10);
    console.log("Got products:", products.length);
    
    // Add favorites
    for (let i = 0; i < 3; i++) {
       await supabase.from('researcher_favorites').upsert({ researcher_id: tom.id, product_id: products[i].id });
    }
    
    // Add recently viewed
    for (let i = 3; i < 7; i++) {
       await supabase.from('researcher_recently_viewed').upsert({ 
         researcher_id: tom.id, 
         product_id: products[i].id, 
         agent_id: tom.referring_agent_id 
       });
    }
    
    // Add past order
    const orderRes = await supabase.from('orders').insert({
      researcher_id: tom.id,
      agent_id: tom.referring_agent_id,
      total_amount: 150.00,
      status: 'completed',
      shipping_status: 'shipped',
      stripe_session_id: 'fake_sess_' + Date.now()
    }).select();
    
    const order = orderRes.data[0];
    
    await supabase.from('order_items').insert([
      { order_id: order.id, product_id: products[7].id, quantity: 2, unit_price: 50.00 },
      { order_id: order.id, product_id: products[8].id, quantity: 1, unit_price: 50.00 }
    ]);
    
    console.log("Successfully added dummy data!");
  }
}

run();
