require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: agent } = await supabase.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  const { data: orders } = await supabase.from('orders').select('id, created_at, status, total').eq('agent_id', agent.id);
  console.log("Agent Orders:", orders.length);
  orders.forEach(o => console.log(o.created_at));
}
main();
