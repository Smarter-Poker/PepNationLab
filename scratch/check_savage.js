const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data: products } = await supabase
    .from('products')
    .select('id, name, base_price, cost_price, msrp');
    
  const agentId = '844dca4b-6f01-4779-bc95-bfa1e0809c0c'; // Savage Brands
  const { data: agentProducts } = await supabase
    .from('agent_products')
    .select('product_id, base_price, msrp, custom_image_url')
    .eq('agent_id', agentId);

  fs.writeFileSync('scratch/output10.json', JSON.stringify({
    products,
    agentProducts
  }, null, 2));
}

main();
