const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const eddieId = '9af517c8-2365-46c1-afa4-77b0df3ffbc8';
  const { data: eddieProducts } = await supabase.from('agent_products').select('product_id, custom_image_url').eq('agent_id', eddieId).limit(5);
  console.log("Eddie Razz Products:", eddieProducts);
  
  const { data: downlines } = await supabase.from('agent_relationships').select('*').eq('downline_id', eddieId);
  console.log("Eddie Razz downline relation:", downlines);
}
run();
