require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRPC() {
  const { data, error } = await supabase.rpc('temp_run_sql', {
    query: "SELECT proname FROM pg_proc WHERE proname = 'agent_sales_summary';"
  });
  console.log(data);
}
checkRPC();
