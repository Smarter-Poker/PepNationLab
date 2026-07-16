import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, total, discount_amount, shipping_cost, agent_id,
      order_items (
        quantity, unit_retail_price, unit_cost_price, unit_super_agent_cost,
        products ( base_cost )
      )
    `)
    .neq('status', 'cancelled')
    .limit(3);

  console.log(error);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
