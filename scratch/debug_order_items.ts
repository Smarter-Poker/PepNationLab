import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: weekOrders } = await supabase.from('orders')
    .select('id, agent_id, order_items(unit_cost_price, unit_super_agent_cost)')
    .gte('created_at', '2026-07-15T00:00:00Z');
    
  console.log(JSON.stringify(weekOrders, null, 2));
}

main().catch(console.error);
