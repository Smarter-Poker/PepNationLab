import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: users } = await supabase.from('profiles').select('id, full_name, username, role, referring_agent_id, parent_agent_id').ilike('full_name', '%anna%');
  console.log("Annas:", users);

  if (users && users.length > 0) {
    const { data: orders } = await supabase.from('orders').select('id, agent_id, buyer_id').eq('buyer_id', users[0].id);
    console.log("Anna's orders:", orders);
    
    if (orders && orders.length > 0) {
       const agentId = orders[0].agent_id;
       const { data: agent } = await supabase.from('profiles').select('id, full_name, role').eq('id', agentId).single();
       console.log("Agent for order:", agent);
    }
  }
}
main();
