const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: sbAgent } = await sb.from('agent_profiles').select('id, slug').eq('slug', 'savagebrands').single();
  console.log('Savage Brands ID:', sbAgent.id);
  
  // Find downline agents
  const { data: downlines } = await sb.from('agent_profiles').select('id, slug, parent_agent_id').eq('parent_agent_id', sbAgent.id);
  console.log('Downline agents:', downlines.length);
  
  if (downlines.length > 0) {
    const dl = downlines[0];
    console.log('Checking agent products for downline:', dl.slug);
    const { data: prods } = await sb.from('agent_products').select('product_id, custom_image_url').eq('agent_id', dl.id).limit(5);
    console.log(prods);
  }
}
run();
