require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      buyer_id: '00000000-0000-0000-0000-000000000000', // random uuid, will fail RLS if not service role, but we use service role. Wait, buyer_id must be a valid user uuid if there's an FK constraint!
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
