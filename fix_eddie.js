require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const ap_id = '80ab0b9f-0bda-43d9-9d51-89ae94ab17cc'; // Reta 10mg
  const agent_id = '9af517c8-2365-46c1-afa4-77b0df3ffbc8'; // Eddie
  
  // Set retail price to 36.97
  await supabase.from('agent_products').update({ retail_price: 36.97 }).eq('agent_id', agent_id).eq('product_id', ap_id);
  console.log('Fixed Eddie Reta 10mg to 36.97');
}
run();
