import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('orders').insert({
    buyer_id: '2db791ef-00fe-43b5-af40-e8c07c93fe1f',
    agent_id: '844dca4b-6f01-4779-bc95-bfa1e0809c0c',
    status: 'pending_customer_payment',
    fulfillment_method: 'ship',
    payment_method: 'zelle',
    shipping_cost: 0,
    subtotal: 10,
    discount_amount: 0,
    total: 10,
    tax_amount: 0
  }).select('id, agent_id').single();
  
  console.log('Inserted Order:', data);
  console.log('Error:', error);
  
  // cleanup
  if (data) await supabase.from('orders').delete().eq('id', data.id);
}
run();
