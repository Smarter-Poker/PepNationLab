const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('profiles').select('id, full_name, email, role, referring_agent_id, parent_agent_id').eq('id', '2db791ef-00fe-43b5-af40-e8c07c93fe1f');
  console.log(data);
}
run();
