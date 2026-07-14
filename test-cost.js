const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: rows } = await supabase.from('agent_products').select('product_id, products(base_cost)').eq('agent_id', '844dca4b-6f01-4779-bc95-bfa1e0809c0c').limit(5);
  console.log(JSON.stringify(rows, null, 2));
}
test();
