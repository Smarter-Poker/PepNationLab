import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: adamProfile } = await supabase.from('profiles').select('id, is_super_agent').eq('full_name', 'Adam Donnahue').single();
  const adamId = adamProfile!.id;
  
  let billableAgentIds = [adamId];
  if (adamProfile!.is_super_agent) {
    const { data: subs } = await supabase.from('profiles').select('id').eq('parent_agent_id', adamId);
    billableAgentIds = [...billableAgentIds, ...subs!.map(s => s.id)];
  }
  console.log("Adam's billable agents count:", billableAgentIds.length);
  
  const { data: weekOrders, error } = await supabase.from('orders')
    .select('id, agent_id, shipping_cost, order_items(unit_cost_price, quantity, unit_super_agent_cost)')
    .in('agent_id', billableAgentIds)
    .gte('agent_approved_at', '2026-07-13T00:00:00Z')
    .lt('agent_approved_at', '2026-07-20T00:00:00Z')
    .neq('status', 'cancelled');
    
  console.log("Orders found for Adam:", weekOrders?.length);
  console.log(error);
  console.log(JSON.stringify(weekOrders, null, 2));
}

main().catch(console.error);
