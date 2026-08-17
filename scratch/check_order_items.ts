import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const { data: items, error } = await supabase
    .from('order_items')
    .select('id, product_name, unit_retail_price, unit_cost_price, unit_super_agent_cost, unit_house_cost')
    .eq('order_id', '3c004a00-b1f5-4d77-a5ff-0c85e44e07e4');

  console.log("Error:", error);
  console.log("Items:", items);
}
test();
