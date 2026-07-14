const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data, error } = await supabase.from('products').select('name, base_cost, market_avg_price').limit(500);
  const keywords = ['snap', 'epitalon', 'ipamorelin', 'klow', 'retatrutide', 'mots', 'tesamorelin', 'cjc', 'wolverine', 'pt-141', 'melanotan', 'glow'];
  const found = data.filter(p => keywords.some(k => p.name.toLowerCase().includes(k)));
  console.log(found.map(f => `${f.name}:\n  Base Cost: $${f.base_cost}\n  Market Avg (Retail): $${f.market_avg_price}`).join('\n\n'));
})();
