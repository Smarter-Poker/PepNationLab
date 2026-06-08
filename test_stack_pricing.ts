import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: c } = await supabase.from('compounds').select('slug, display_name').eq('display_name', 'Cagrilintide + Semaglutide').single();
  console.log("Compound:", c);
  if (c) {
    const { data: p } = await supabase.from('products').select('id, name, compound_slug').eq('compound_slug', c.slug);
    console.log("Products mapped to this stack:", p);
    
    if (p && p.length > 0) {
      const { data: ap } = await supabase.from('agent_products').select('id, retail_price').in('product_id', p.map(x => x.id));
      console.log("Agent Products (prices):", ap);
    }
  }
}
main();
