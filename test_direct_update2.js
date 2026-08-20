require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('agent_products')
    .update({ retail_price: 150.97 })
    .eq('id', '17d6c55c-dafc-41bf-a0f0-b51588c703f2')
    .select('*');
    
  console.log('Data:', data);
  console.log('Error:', error);
}
run();
