const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: downlines, error } = await sb.rpc('fn_admin_downline_tree', { p_days: 30 });
  if (error) {
    console.error(error);
    return;
  }
  const savageDownline = downlines.filter(d => d.root_agent_id === '844dca4b-6f01-4779-bc95-bfa1e0809c0c' || d.super_agent_id === '844dca4b-6f01-4779-bc95-bfa1e0809c0c');
  console.log('Total Savage Brands network size:', savageDownline.length);
  if (savageDownline.length > 0) {
    const dl = savageDownline.find(d => d.agent_id !== '844dca4b-6f01-4779-bc95-bfa1e0809c0c');
    if (dl) {
      console.log('Found downline agent:', dl.agent_name, dl.slug);
      const { data: prods } = await sb.from('agent_products').select('product_id, custom_image_url').eq('agent_id', dl.agent_id).limit(1);
      console.log('Has custom images?', prods);
    }
  }
}
run();
