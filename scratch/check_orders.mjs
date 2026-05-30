import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: orders } = await supabase.from('orders').select('id, buyer_id, agent_id, status').eq('buyer_id', '2db791ef-00fe-43b5-af40-e8c07c93fe1f');
  console.log('Anna Orders:', orders);
}
run();
