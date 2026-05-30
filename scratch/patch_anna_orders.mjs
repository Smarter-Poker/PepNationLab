import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: updateRes, error } = await supabase
    .from('orders')
    .update({ agent_id: '844dca4b-6f01-4779-bc95-bfa1e0809c0c' })
    .eq('buyer_id', '2db791ef-00fe-43b5-af40-e8c07c93fe1f');
    
  console.log('Update Data:', updateRes);
  console.log('Update Error:', error);
}
run();
