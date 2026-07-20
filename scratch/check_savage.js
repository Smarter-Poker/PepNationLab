const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const agentId = '844dca4b-6f01-4779-bc95-bfa1e0809c0c'; // Savage Brands

  const { data: subAgents } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('parent_agent_id', agentId);

  const allIds = [agentId, ...(subAgents ? subAgents.map(sa => sa.id) : [])];

  const { data: orders } = await supabase
    .from('orders')
    .select('id, created_at, agent_approved_at, status, subtotal, shipping_cost, total, agent_id, order_items(product_name, quantity, unit_cost_price, unit_super_agent_cost)')
    .in('agent_id', allIds)
    .gte('agent_approved_at', '2026-07-13T00:00:00.000Z')
    .order('created_at', { ascending: false });

  fs.writeFileSync('scratch/output9.json', JSON.stringify({
    allIds,
    orders: orders
  }, null, 2));
}

main();
