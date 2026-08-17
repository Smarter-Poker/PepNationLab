import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, unit_size, base_cost, house_cost')
    .ilike('name', '%retatrutide%');

  console.log("Products:", products);
}
test();
