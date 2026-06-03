require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAll() {
  const rpcs = fs.readFileSync('rpc_list.txt', 'utf8').split('\n').filter(Boolean);
  const { data, error } = await supabase.rpc('temp_run_sql', {
    query: "SELECT json_agg(proname) FROM pg_proc WHERE proname IN ('" + rpcs.join("','") + "');"
  });
  if (error) { console.error(error); return; }
  const existing = new Set(data || []);
  const missing = rpcs.filter(rpc => !existing.has(rpc));
  console.log("Missing RPCs:", missing);
}
checkAll();
