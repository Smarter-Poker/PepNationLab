const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test_ws_debug@example.com',
    password: 'Password123!'
  });
  if (error) console.error("LOGIN ERROR:", error);
  else console.log(JSON.stringify(data.session));
}
run();
