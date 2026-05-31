require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: profiles } = await supabase.from('profiles').select('id').limit(1);
  if (!profiles || profiles.length === 0) return console.log("No profiles");
  
  const buyer_id = profiles[0].id;

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      buyer_id: buyer_id,
      agent_id: null,
      is_wholesale_restock: false,
      status: 'pending_customer_payment',
      fulfillment_method: 'agent_pickup',
      payment_method: 'zelle',
      shipping_address: null,
      shipping_cost: 0,
      subtotal: 10,
      discount_amount: 0,
      coupon_code: null,
      total: 10,
      tax_amount: 0,
      tax_jurisdiction: null,
      tax_exemption_id: null
    });
  
  console.log("Error:", error);
}

run();
