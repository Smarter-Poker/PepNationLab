import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data, error } = await supabase.from('products').select('name, base_cost, wholesale_price, retail_price').ilike('name', '%BPC-157%').limit(1);
  console.log(JSON.stringify(data, null, 2));
})();
