const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: eddie, error } = await supabase.from('agent_profiles').select('*').ilike('display_name', '%Eddie%');
  console.log("Eddie Razz:", eddie, error);
  
  const { data: eddie2 } = await supabase.from('agent_profiles').select('*').ilike('slug', '%eddie%');
  console.log("Eddie Razz (slug):", eddie2);
}
run();
