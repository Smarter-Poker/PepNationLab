require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function get() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: prof, error } = await supabase.from('agent_profiles').select('bundles_config').eq('id', '844dca4b-6f01-4779-bc95-bfa1e0809c0c').single();
  const bundles = prof.bundles_config.filter(b => b.name === 'Sexy Savage' || b.name === 'Swole Savage');
  console.log(JSON.stringify(bundles.map(b => ({ name: b.name, image_url: b.image_url })), null, 2));
}
get();
