const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: prods } = await sb.from('agent_products').select('product_id, custom_image_url').eq('agent_id', '844dca4b-6f01-4779-bc95-bfa1e0809c0c');
  const withCustom = prods.filter(p => p.custom_image_url);
  const withoutCustom = prods.filter(p => !p.custom_image_url);
  console.log('Savage Brands Custom Images:', withCustom.length);
  console.log('Savage Brands Missing Images:', withoutCustom.length);
}
run();
