const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sql = fs.readFileSync('/Users/smarter.poker/Documents/pepnationlab/supabase/migrations/20260723190000_site_traffic_summary_fix_orders.sql', 'utf8');

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  console.log(data, error);
}
run();
