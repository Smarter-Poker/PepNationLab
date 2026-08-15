require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function fix() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: agent } = await supabase.from('agent_profiles').select('id, slug').ilike('slug', '%savage%').limit(1).single();
  const { data: prods, error } = await supabase.from('agent_products').select('id, custom_image_url, product_id, products(name)').eq('agent_id', agent.id);
  console.log("Error:", error);
  if (!prods) return;
  const matches = prods.filter(p => p.products && (p.products.name.toLowerCase().includes('shred') || p.products.name.toLowerCase().includes('limitless')));
  console.log("Matches:", matches);
}
fix();
