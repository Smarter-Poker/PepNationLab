import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: p } = await supabase.from('products').select('id, name, compound_slug').eq('compound_slug', 'cagrisema');
  
  if (p && p.length > 0) {
    const { data: ap } = await supabase.from('agent_products').select('id, retail_price, agent_id').in('product_id', p.map(x => x.id));
    console.log("Agent Products (prices) for cagrisema:", ap);
  }

  // Also let's check for cjc-1295-no-dac-ipamorelin
  const { data: p2 } = await supabase.from('products').select('id, name, compound_slug').eq('compound_slug', 'cjc-1295-no-dac-ipamorelin');
  if (p2 && p2.length > 0) {
    const { data: ap2 } = await supabase.from('agent_products').select('id, retail_price, agent_id').in('product_id', p2.map(x => x.id));
    console.log("Agent Products (prices) for cjc-ipa:", ap2);
  }
}
main();
