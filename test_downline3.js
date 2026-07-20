const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: sbAgent } = await sb.from('agent_profiles').select('id, slug').eq('slug', 'savagebrands').single();
  console.log('Savage Brands ID:', sbAgent.id);
  
  // Find profiles where parent_agent_id is Savage Brands
  const { data: downlineProfiles } = await sb.from('profiles').select('id, email').eq('parent_agent_id', sbAgent.id);
  console.log('Downline profiles:', downlineProfiles.length);
  
  if (downlineProfiles.length > 0) {
    console.log(downlineProfiles.map(p => p.email));
  }
}
run();
