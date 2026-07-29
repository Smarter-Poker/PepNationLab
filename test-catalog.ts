import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  const { data } = await supabase.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  const { data: agentProducts } = await supabase.from('agent_products').select('product_id, is_visible').eq('agent_id', data.id);
  const { data: products } = await supabase.from('products').select('id, name, category, is_active, inventory_count').in('id', agentProducts.map(a => a.product_id));
  const stacks = products.filter(p => p.name.toLowerCase().includes('stack') || p.category === 'Peptide Stacks');
  console.log("Stacks found:", stacks.length);
  console.log(stacks.map(s => ({ name: s.name, is_active: s.is_active, is_visible: agentProducts.find(a => a.product_id === s.id)?.is_visible, count: s.inventory_count })));
}
main();
