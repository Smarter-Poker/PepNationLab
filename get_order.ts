import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, buyer:profiles!orders_buyer_id_fkey(full_name, email, role), agent:profiles!orders_agent_id_fkey(full_name, email, role)')
    .eq('id', '770b5503-79a6-493a-8fc3-7dea78d3046a')
    .single();

  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
run();
