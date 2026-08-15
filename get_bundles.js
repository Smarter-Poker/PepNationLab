require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function get() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: prof, error } = await supabase.from('agent_profiles').select('bundles_config').eq('id', '844dca4b-6f01-4779-bc95-bfa1e0809c0c').single();
  const shredder = prof.bundles_config.find(b => b.name === 'Savage Shredder');
  console.log(JSON.stringify(shredder, null, 2));
}
get();
