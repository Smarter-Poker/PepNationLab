import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: products } = await supabase.from('products').select('name, compound_slug, category').order('name');
  
  if (products) {
    console.log("Full Catalog List:");
    products.forEach(p => console.log(`- ${p.name} (Slug: ${p.compound_slug}, Cat: ${p.category})`));
  }
}
main();
