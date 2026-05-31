const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('profiles').select('id, full_name, email, username');
  console.log('Profiles:', data?.length);
  const me = data.find(p => p.username === 'test_ws_debug' || (p.email && p.email.includes('test')));
  const anna = data.find(p => p.username === 'anna' || p.full_name === 'Anna');
  console.log('Me:', me);
  console.log('Anna:', anna);
}
run().catch(console.error);
