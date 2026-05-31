require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: triggers, error } = await supabase.rpc('get_triggers', { p_table_name: 'orders' });
  if (error) {
    console.log("No RPC get_triggers", error.message);
  } else {
    console.log("Triggers:", triggers);
  }
}

run();
