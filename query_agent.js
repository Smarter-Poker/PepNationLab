require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data } = await supabase.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  const agentId = data.id;
  const { data: orders, error } = await supabase.from('orders').select('id, created_at, status, total').or(`agent_id.eq.${agentId},parent_agent_id.eq.${agentId}`);
  if (error) console.error(error);
  console.log(orders);
}
main();
