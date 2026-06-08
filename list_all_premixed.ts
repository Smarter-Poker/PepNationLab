import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: products } = await supabase.from('products').select('id, name, compound_slug').order('name');
  
  if (products) {
    console.log("Potential Pre-mixed Products:");
    for (const p of products) {
      if (p.name.includes('+') || p.name.toLowerCase().includes('stack') || p.name.toLowerCase().includes('blend')) {
        console.log(`- ${p.name} (slug: ${p.compound_slug})`);
      }
    }
  }
}
main();
