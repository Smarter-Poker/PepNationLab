const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: sbAgent } = await sb.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  const { data: profiles } = await sb.from('profiles').select('id').eq('parent_agent_id', sbAgent.id);
  
  const downlineIds = profiles.map(p => p.id);
  
  const { data: agents } = await sb.from('agent_profiles').select('id, slug').in('id', downlineIds);
  console.log('Downline Agent Slugs:', agents.map(a => a.slug));
  
  // Check if they have custom_image_url
  for (const agent of agents) {
    const { data: prods } = await sb.from('agent_products').select('product_id, custom_image_url').eq('agent_id', agent.id).not('custom_image_url', 'is', null);
    console.log(`Agent ${agent.slug} custom images:`, prods.length);
  }
}
run();
