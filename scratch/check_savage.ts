import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // 1. Get savagebrands profile
  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('id, slug')
    .eq('slug', 'savagebrands')
    .single();

  if (!profile) {
    console.error("Could not find savagebrands in agent_profiles");
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, role');
    console.log("Profiles available:", profiles.filter(p => p.full_name?.toLowerCase().includes('savage')));
    return;
  }

  const agentId = profile.id;
  console.log(`Agent ID: ${agentId}`);

  // 2. Get statements
  const { data: statements } = await supabase
    .from('weekly_statements')
    .select('*')
    .eq('agent_id', agentId)
    .order('week_start', { ascending: false });

  console.log('Statements:', statements);

  // 3. Get recent orders
  const { data: orders } = await supabase
    .from('orders')
    .select('id, created_at, status, subtotal, shipping_cost, tax, total, agent_id, order_items(quantity, unit_price, unit_cost_price, unit_super_agent_cost)')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Orders:', JSON.stringify(orders, null, 2));
}

main();
