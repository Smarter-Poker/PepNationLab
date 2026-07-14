const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data, error } = await supabase.from('products').select('name, unit_size, unit_measure, base_cost, market_avg_price').ilike('name', '%melanotan%');
  console.log(data);
})();
