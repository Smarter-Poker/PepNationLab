const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  await supabase.from('profiles').update({ role: 'admin' }).eq('email', 'test_ws_debug@example.com');
  console.log('Done');
}
run();
