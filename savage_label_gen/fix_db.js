const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: agentData } = await supabase.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  const agentId = agentData.id;

  const { data: ap } = await supabase.from('agent_products').select('product_id, custom_image_url, products(slug, name)').eq('agent_id', agentId);
  
  for (const item of ap) {
    if (item.custom_image_url && item.custom_image_url.includes('-v2.png')) {
       const slug = item.products.slug || item.products.name.replace(/\s+/g, '-').toLowerCase();
       const newUrl = `/images/savage-brands/${slug}.png`;
       await supabase.from('agent_products').update({ custom_image_url: newUrl }).eq('agent_id', agentId).eq('product_id', item.product_id);
       console.log(`Reverted ${item.products.name} back to ${newUrl}`);
    }
  }
}
run();
