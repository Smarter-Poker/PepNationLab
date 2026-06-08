require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: stacks } = await supabase.from('compounds').select('slug, display_name, stack_components').eq('is_stack', true);
  const { data: products } = await supabase.from('products').select('compound_slug');
  const slugs = new Set(products.map(p => p.compound_slug));
  
  for (const stack of stacks) {
    if (stack.stack_components.length === 1 && !slugs.has(stack.slug)) {
      console.log('Orphan 1-comp stack:', stack.slug);
    }
  }
}
run();
