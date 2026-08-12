const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const orderId = '9940f7bf-2d82-450e-a393-b73b3f1d5046';
  const { data: order } = await supabase.from('orders').select('*, profiles!orders_buyer_id_fkey(*)').eq('id', orderId).single();
  console.log("Order Email:", order.buyer_email);
  console.log("Shipping Email:", order.shipping_address?.email);
  console.log("Profile Email:", order.profiles?.email);
  console.log("Contact Email:", order.profiles?.contact_email);
}
run();
