const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envs = fs.readFileSync('.env.local', 'utf8').split('\n');
let url = '', key = '';
envs.forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '');
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '');
});

const supabase = createClient(url, key);
async function run() {
  const savageId = '844dca4b-6f01-4779-bc95-bfa1e0809c0c';
  
  // Get the agent_profiles record for savage brands
  const { data, error } = await supabase.from('agent_profiles').select('*').eq('id', savageId).maybeSingle();
  if (error) { console.error(error); return; }
  console.log('Savage Brands agent_profile:', JSON.stringify(data, null, 2));
}
run();
