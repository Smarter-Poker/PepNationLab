import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: agent } = await supabase.from('agent_profiles').select('id, slug').eq('slug', 'savagebrands').single();
  if (!agent) {
    console.log("No savagebrands agent found");
    return;
  }
  
  const { data: agentProducts, error } = await supabase
    .from('agent_products')
    .select('id, custom_image_url, products(name)')
    .eq('agent_id', agent.id)
    .not('custom_image_url', 'is', null)
    .limit(10);
    
  console.log("Savage Brands products with custom images:");
  console.log(JSON.stringify(agentProducts, null, 2));

  const { count } = await supabase
    .from('agent_products')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agent.id)
    .not('custom_image_url', 'is', null);
    
  console.log("Total Savage Brands products WITH custom images:", count);

  const { count: countAll } = await supabase
    .from('agent_products')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agent.id);
    
  console.log("Total Savage Brands products:", countAll);
}
main().catch(console.error);
