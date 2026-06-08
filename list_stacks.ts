import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: compounds } = await supabase.from('compounds').select('slug, display_name, is_stack, stack_components').eq('is_stack', true);
  
  if (compounds) {
    for (const c of compounds) {
      console.log(`Stack: ${c.display_name} (slug: ${c.slug})`);
      console.log(`Components: ${c.stack_components?.join(', ')}`);
      
      const { data: products } = await supabase.from('products').select('name').eq('compound_slug', c.slug);
      if (products && products.length > 0) {
        console.log(`Associated Products:`);
        products.forEach(p => console.log(` - ${p.name}`));
      }
      console.log('---');
    }
  }
}
main();
