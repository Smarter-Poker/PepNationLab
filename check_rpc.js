require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRPC() {
  const { data, error } = await supabase.rpc('temp_run_sql', {
    query: "SELECT proname FROM pg_proc WHERE proname = 'consume_slug_reservation';"
  });
  console.log(data);
}
checkRPC();
