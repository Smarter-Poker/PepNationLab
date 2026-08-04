const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: allProfiles, error } = await supabase.from('profiles').select('id, username, display_name');
  console.log("All Profiles:", allProfiles);
  
  const { data: agentProfiles } = await supabase.from('agent_profiles').select('id, slug, name');
  console.log("Agent Profiles:", agentProfiles);
}

run();
