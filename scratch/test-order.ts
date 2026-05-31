import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testing full order insert...');
  
  // 1. Get a buyer who is a researcher with a referring agent
  const { data: profile } = await supabase.from('profiles').select('*').not('referring_agent_id', 'is', null).limit(1).single();
  if (!profile) {
    console.log('No suitable profile found.');
    return;
  }
  console.log('Buyer:', profile.id, 'Agent:', profile.referring_agent_id);

  // 2. Insert order
  const { data: order, error: orderError } = await supabase.from('orders').insert({
    buyer_id: profile.id,
    agent_id: profile.referring_agent_id,
    is_wholesale_restock: false,
    status: 'pending_customer_payment',
    fulfillment_method: 'agent_pickup',
    payment_method: 'cashapp',
    shipping_address: null,
    shipping_cost: 0,
    subtotal: 10,
    total: 10,
    discount_amount: 0,
    tax_amount: 0,
    tax_jurisdiction: null,
    tax_exemption_id: null,
    idempotency_key: null,
  }).select('id').single();

  if (orderError) {
    console.error('Order Error:', orderError);
    return;
  }
  console.log('Order created:', order.id);

  // 3. Get a product
  const { data: product } = await supabase.from('products').select('*').limit(1).single();

  // 4. Insert order_items
  const { error: itemsError } = await supabase.from('order_items').insert([{
    order_id: order.id,
    product_id: product.id,
    product_name: product.name,
    quantity: 1,
    unit_retail_price: 10,
    unit_cost_price: 5,
    unit_super_agent_cost: null,
  }]);

  if (itemsError) {
    console.error('Items Error:', itemsError);
  } else {
    console.log('Items inserted successfully');
    await supabase.from('orders').delete().eq('id', order.id);
  }
}

test().catch(console.error);
