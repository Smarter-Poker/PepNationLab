const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('agent_products').select('custom_image_url').eq('agent_id', '45f75d5b-674f-444a-b7ab-4757a9228ee5').limit(5);
  console.log(data);
}
run();
