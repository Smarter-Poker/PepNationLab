const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const savageId = '844dca4b-6f01-4779-bc95-bfa1e0809c0c';
  const { data: downlines } = await supabase.from('profiles').select('id, full_name, username').eq('parent_agent_id', savageId);
  console.log("Savage Brands downlines:", downlines);
}
run();
