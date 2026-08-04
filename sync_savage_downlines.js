const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const savageId = '844dca4b-6f01-4779-bc95-bfa1e0809c0c';
  
  // Get Savage Brands customizations
  const { data: savageProducts } = await supabase
    .from('agent_products')
    .select('product_id, custom_image_url, custom_name, custom_description')
    .eq('agent_id', savageId)
    .not('custom_image_url', 'is', null);
    
  console.log(`Found ${savageProducts.length} Savage Brands customizations`);

  // Get all downlines
  const { data: downlines } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('parent_agent_id', savageId);
    
  console.log(`Found ${downlines.length} downline agents`);
  
  let totalUpdates = 0;
  for (const agent of downlines) {
    console.log(`Processing downline: ${agent.username} (${agent.id})`);
    
    // For each customized product, update this agent's matching product
    for (const prod of savageProducts) {
      const { error } = await supabase
        .from('agent_products')
        .update({
          custom_image_url: prod.custom_image_url,
          custom_name: prod.custom_name,
          custom_description: prod.custom_description
        })
        .eq('agent_id', agent.id)
        .eq('product_id', prod.product_id);
        
      if (error) {
        console.error(`Error updating product ${prod.product_id} for agent ${agent.username}:`, error);
      } else {
        totalUpdates++;
      }
    }
  }
  
  console.log(`Successfully applied ${totalUpdates} product customizations to downline storefronts.`);
}
run();
