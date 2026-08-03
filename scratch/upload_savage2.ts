import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const files = [
    {
      slug: 'test-epithalon-pepnation',
      name: 'Epithalon 10mg (PepNation Test)'
    },
    {
      slug: 'test-epithalon-savage',
      name: 'Epithalon 10mg (Savage Brands Test)'
    }
  ];

  for (const f of files) {
    try {
      const { data: pData, error: pError } = await supabase.from('products').insert({
        slug: f.slug,
        name: f.name,
        category: 'Anti-Aging',
        unit_size: 10,
        unit_measure: 'mg',
        is_active: true,
        base_cost: 15.00,
        min_retail_price: 30.00
      }).select();
      
      if (pError && pError.code !== '23505') console.error('Insert error:', pError);
      else console.log('Inserted product', f.slug);
      
    } catch (e) {
      console.error(e);
    }
  }
}
run();
