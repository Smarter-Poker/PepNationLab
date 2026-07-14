const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const savageId = '844dca4b-6f01-4779-bc95-bfa1e0809c0c';
  const { data: ap, error: errP } = await supabase
    .from('agent_products')
    .select('retail_price, is_visible, products(name, base_cost, slug)')
    .eq('agent_id', savageId);
  const filtered = ap.filter(item => item.products && item.products.name && item.products.name.toLowerCase().includes('melanotan'));
  filtered.forEach(f => {
    console.log(`- ${f.products.name}: Base $${f.products.base_cost}, Retail $${f.retail_price}`);
  });
})();
