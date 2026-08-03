import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data: pData, error: pError } = await supabase.from('products').insert({
    slug: 'test-epithalon-7',
    name: 'Epithalon 10mg (Test Print 7)',
    category: 'Anti-Aging',
    unit_size: 10,
    unit_measure: 'mg',
    is_active: true,
    base_cost: 0,
    min_retail_price: 0
  }).select();
  
  if (pError && pError.code !== '23505') {
    console.error('Insert error:', pError);
  } else {
    console.log('Inserted product test-epithalon-7');
  }
}
run();
