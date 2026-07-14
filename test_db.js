const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data, error } = await supabase.from('products').select('name, slug, base_cost, retail_price').limit(200);
  if (error) {
    console.error('Supabase error:', error);
  } else {
    const keywords = ['snap', 'epitalon', 'ipamorelin', 'klow', 'retatrutide', 'mots', 'tesamorelin', 'cjc', 'wolverine', 'pt-141', 'melanotan', 'glow'];
    const found = data.filter(p => keywords.some(k => p.name.toLowerCase().includes(k)));
    console.log(found.map(f => `${f.name}: Cost $${f.base_cost}, Retail $${f.retail_price}`).join('\n'));
  }
})();
