const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await sb.from('orders').select('id, status, created_at, agent_id').order('created_at', { ascending: false }).limit(20);
  console.log(data);
}
run();
