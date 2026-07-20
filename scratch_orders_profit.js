const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const agentId = "40e9f391-2bb8-4eea-9495-c9edfe9ff0ed";
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, subtotal, total, agent_id, status, created_at, order_items(unit_cost_price, unit_retail_price, unit_super_agent_cost, quantity)')
    .eq('agent_id', agentId);
  
  if (error) console.error(error);
  else {
    console.log("Orders:", JSON.stringify(orders, null, 2));
  }

  const { data: comms, error: e2 } = await supabase
    .from('sub_agent_commission_ledger')
    .select('*')
    .eq('sub_agent_id', agentId);
  
  if (e2) console.error(e2);
  else console.log("Commissions:", JSON.stringify(comms, null, 2));
}

main();
