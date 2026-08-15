require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function fix() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Revert the agent_products row I accidentally touched
  const { error: e1 } = await supabase.from('agent_products').update({ custom_image_url: '/images/savage-brands/the-limitless-stack-semax-selank.png' }).eq('id', '26a1da50-07ff-44e5-8313-38e3bcb07775');
  console.log("Revert limit stack:", e1);
  
  // Update the bundles_config in agent_profiles
  const { data: prof, error: e2 } = await supabase.from('agent_profiles').select('bundles_config').eq('id', '844dca4b-6f01-4779-bc95-bfa1e0809c0c').single();
  
  const bundles = prof.bundles_config;
  const shredder = bundles.find(b => b.name === 'Savage Shredder');
  if (shredder) {
    shredder.image_url = '/images/savage-brands/savage-shredder-stack.jpg';
    shredder.vial_image_url = '/images/savage-brands/savage-shredder-stack.jpg';
    
    const { error: e3 } = await supabase.from('agent_profiles').update({ bundles_config: bundles }).eq('id', '844dca4b-6f01-4779-bc95-bfa1e0809c0c');
    console.log("Update bundle:", e3);
  }
}
fix();
