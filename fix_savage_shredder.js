require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function fix() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: agent } = await supabase.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  if (!agent) { console.log('Savage Brands not found'); return; }
  
  // Find the agent product that corresponds to the Savage Shredder.
  // In the generic catalog, it might be called "Limitless Stack" or "Shredder".
  // Let's query all agent_products for this agent, joining products to see names and custom_image_url
  const { data: prods } = await supabase.from('agent_products').select('id, custom_image_url, products(name)').eq('agent_id', agent.id);
  
  const shredder = prods.find(p => p.products.name.toLowerCase().includes('shredder') || p.products.name.toLowerCase().includes('limitless'));
  console.log("Found Shredder candidate:", shredder);
  
  if (shredder) {
    const { error } = await supabase.from('agent_products').update({ custom_image_url: '/images/savage-brands/savage-shredder-stack.jpg' }).eq('id', shredder.id);
    console.log("Update Error:", error);
  }
}
fix();
