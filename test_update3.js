require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('agent_products')
    .update({ retail_price: 29.97, margin_percent: 13.26 })
    .eq('id', '3be2ad10-3a33-49c5-8cb2-8b632bfd6a91')
    .select('*');
    
  console.log('Data:', data);
  console.log('Error:', error);
}
run();
