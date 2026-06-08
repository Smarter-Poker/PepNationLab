import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: compounds } = await supabase.from('compounds').select('slug, display_name, is_stack').eq('is_stack', true);
  const stackSlugs = new Set(compounds?.map(c => c.slug));

  const { data: products } = await supabase.from('products').select('id, name, compound_slug').order('name');
  
  console.log("Checking for 'stack' or 'blend' products mapped to a non-stack compound slug:");
  if (products) {
    for (const p of products) {
      if (p.name.includes('+') || p.name.toLowerCase().includes('stack') || p.name.toLowerCase().includes('blend')) {
        if (!stackSlugs.has(p.compound_slug)) {
          console.log(`- ${p.name} (mapped to slug: ${p.compound_slug}) -> WARNING: ${p.compound_slug} is NOT flagged as is_stack=true in compounds!`);
        }
      }
    }
  }
}
main();
