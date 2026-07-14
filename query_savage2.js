const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: agents, error: errA } = await supabase.from('agent_profiles').select('id, display_name, slug').ilike('display_name', '%savage%');
  if (errA || !agents || agents.length === 0) {
    console.error('No savage agent found:', errA || agents);
    return;
  }
  const savageId = agents[0].id;
  console.log('Found Agent:', agents[0].display_name, savageId);

  const { data: ap, error: errP } = await supabase
    .from('agent_products')
    .select('retail_price, is_visible, products(name, base_cost, slug)')
    .eq('agent_id', savageId);
    
  if (errP) {
    console.error('Error fetching products:', errP);
    return;
  }
  
  const keywords = ['snap', 'epitalon', 'epithalon', 'ipamorelin', 'klow', 'retatrutide', 'mots', 'tesamorelin', 'cjc', 'wolverine', 'pt-141', 'melanotan', 'glow'];
  
  const filtered = ap.filter(item => {
    if (!item.products || !item.products.name) return false;
    const name = item.products.name.toLowerCase();
    return keywords.some(k => name.includes(k));
  });
  
  console.log('\nPricing for ' + agents[0].display_name + ':');
  filtered.forEach(f => {
    console.log(`- ${f.products.name}:\n  Base Cost: $${f.products.base_cost}\n  Current Listed Retail: $${f.retail_price}`);
  });
})();
