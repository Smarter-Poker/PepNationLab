const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const eddieId = '9af517c8-2365-46c1-afa4-77b0df3ffbc8';
  const { data: downlines, error } = await supabase.from('affiliate_network').select('*').eq('downline_id', eddieId);
  console.log("Eddie Razz affiliate_network:", downlines, error);
}
run();
