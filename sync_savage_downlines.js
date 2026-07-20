const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const SAVAGE_ID = '844dca4b-6f01-4779-bc95-bfa1e0809c0c';
  
  // 1. Fetch Savage Brands products and branding
  const { data: sbAgent } = await sb.from('agent_profiles').select('custom_branding').eq('id', SAVAGE_ID).single();
  const { data: sbProducts } = await sb.from('agent_products').select('product_id, custom_image_url').eq('agent_id', SAVAGE_ID).not('custom_image_url', 'is', null);
  
  // 2. Fetch all downlines (assuming 1 level deep for now, we found 4 earlier)
  const { data: downlines } = await sb.from('profiles').select('id').eq('parent_agent_id', SAVAGE_ID);
  const downlineIds = downlines.map(d => d.id);
  
  console.log(`Found ${downlineIds.length} downline(s). Syncing custom branding and ${sbProducts.length} product images...`);
  
  for (const agentId of downlineIds) {
    // Sync branding
    await sb.from('agent_profiles').update({ custom_branding: sbAgent.custom_branding }).eq('id', agentId);
    
    // Sync images
    let updatedCount = 0;
    for (const prod of sbProducts) {
      const { data } = await sb.from('agent_products').update({ custom_image_url: prod.custom_image_url }).eq('agent_id', agentId).eq('product_id', prod.product_id).select('id');
      if (data && data.length > 0) updatedCount++;
    }
    console.log(`Synced agent ${agentId} - updated ${updatedCount} products.`);
  }
  console.log('Sync complete.');
}
run();
