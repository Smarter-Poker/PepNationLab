import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('order_items')
    .select('id, order_id, quantity, unit_price, unit_house_cost')
    .eq('unit_house_cost', 34.86);
  console.log("34.86 unit_house_cost:", data);

  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('id, agent_id, total, status')
    .eq('total', 34.86);
  console.log("34.86 total orders:", orders);
}

run();
