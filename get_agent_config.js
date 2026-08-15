require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function get() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: agent } = await supabase.from('agent_profiles').select('agent_config').ilike('slug', '%savage%').limit(1).single();
  console.log(JSON.stringify(agent.agent_config.bundles, null, 2));
}
get();
