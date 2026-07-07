const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('get_multiple_permissive_policies');
  if (error) {
    console.log("RPC failed, trying raw query...", error);
    // Let's just output the REST API if we don't have RPC.
  }
}
run();
