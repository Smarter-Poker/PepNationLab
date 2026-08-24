require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: agent } = await supabase.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  const { data: downlines } = await supabase.from('profiles').select('id').eq('parent_agent_id', agent.id);
  const downlineIds = (downlines || []).map(d => d.id);
  
  const allAgentIds = [agent.id, ...downlineIds];
  const { data: orders } = await supabase.from('orders').select('id, created_at, status, total').in('agent_id', allAgentIds);
  orders.forEach(o => console.log(o.created_at, o.status, o.total));
}
main();
