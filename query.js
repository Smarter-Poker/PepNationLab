const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('orders').select('id, status, buyer_id, agent_id').order('created_at', { ascending: false }).limit(10);
  console.log(data);
}
run();
