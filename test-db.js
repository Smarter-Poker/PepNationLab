const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase
    .from('order_items')
    .select('id, product_name, quantity, unit_retail_price, unit_cost_price, unit_super_agent_cost, product_id')
    .limit(1);
  console.log({ data, error });
}
run();
