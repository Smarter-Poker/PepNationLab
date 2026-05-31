require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: constraints, error } = await supabase.rpc('get_table_constraints', { p_table_name: 'orders' });
  if (error) {
    // If RPC doesn't exist, use raw query
    const { data: raw, error: rawError } = await supabase.from('orders').select('*').limit(1);
    console.log("Can query orders:", !rawError);
  }
}

run();
