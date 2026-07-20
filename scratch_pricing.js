const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('order_items')
    .select('product_id, unit_retail_price, unit_cost_price')
    .eq('order_id', '770b5503-79a6-493a-8fc3-7dea78d3046a');
  
  if (error) console.error(error);
  
  if (data && data.length > 0) {
    const { data: p, error: pe } = await supabase
      .from('products')
      .select('id, name, price, agent_price, super_agent_price')
      .eq('id', data[0].product_id);
    if (pe) console.error(pe);
    else console.log("Product:", JSON.stringify(p, null, 2));
  }
}

main();
