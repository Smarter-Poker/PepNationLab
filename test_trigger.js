const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

async function run() {
  const svcAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await svcAdmin.rpc('fn_exec_sql', {
    sql_string: `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'fn_mm_after_insert';`
  });
  console.log(data, error);
}
run();
