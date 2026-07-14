import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: agent } = await supabase.from('profiles').select('id').ilike('username', '%savage%').single();
  const { data, error } = await supabase.from('agent_products').select('product:product_id(id, name, category, unit_size, unit_measure)').eq('agent_id', agent?.id);
  if (error) console.error(error);
  else console.log(data?.length, 'products found');
}
run();
