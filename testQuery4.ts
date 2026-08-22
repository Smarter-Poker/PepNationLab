import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: agent } = await supabase.from('profiles').select('id').ilike('username', '%savage%').single();
  const { data, error } = await supabase.from('agent_products').select('product_id, products(id, name, dose_amount, dose_unit, category_id)').eq('agent_id', agent?.id).limit(2);
  console.log(JSON.stringify(data, null, 2));
}
run();
