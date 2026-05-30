const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('profiles').select('*').eq('username', 'savagebrands');
  console.log('Profiles:', data);
  const { data: agent } = await supabase.from('agent_profiles').select('*').eq('slug', 'savagebrands');
  console.log('Agent Profiles:', agent);
}
check();
