const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: agents } = await sb.from('agent_profiles').select('slug, custom_branding').in('slug', ['savagebrands', 'gorczakt3']);
  console.log(agents);
}
run();
