import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, total, status, created_at, agent_id, subtotal, shipping_cost, discount_amount')
    .eq('agent_id', '844dca4b-6f01-4779-bc95-bfa1e0809c0c');
  console.log("Orders:", orders, error);
}

run();
