const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
  await supabase.from('orders').update({ agent_id: '844dca4b-6f01-4779-bc95-bfa1e0809c0c' }).eq('buyer_id', '2db791ef-00fe-43b5-af40-e8c07c93fe1f');
  console.log("Updated Anna's orders to belong to Savage Brands");
}
run();
