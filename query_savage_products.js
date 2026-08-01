const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: agent } = await supabase.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  if (!agent) {
    console.error('Agent savagebrands not found');
    return;
  }
  
  const { data: ap, error } = await supabase.from('agent_products').select('product_id, products(slug, name, unit_size, unit_measure)').eq('agent_id', agent.id);
  
  if (error) {
    console.error('Error fetching products:', error);
  } else {
    console.log(`Found ${ap.length} products for Savage Brands:`, JSON.stringify(ap, null, 2));
  }
}
run();
