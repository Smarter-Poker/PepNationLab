import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  const { data: agent } = await supabase.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  const { data: products } = await supabase.from('agent_products').select('id, custom_image_url, products!inner(id, name)').eq('agent_id', agent?.id);

  const files = fs.readdirSync(path.join(process.cwd(), 'public', 'images', 'savage-brands'));
  const jpgs = files.filter(f => f.endsWith('.jpg'));

  let mapped = 0;
  const updates: any[] = [];
  
  for (const ap of products || []) {
    const prod: any = ap.products;
    const prodNameNorm = normalizeName(prod.name);
    
    // Exact match normalized name
    let bestMatch = jpgs.find(j => normalizeName(j.replace('.jpg', '')) === prodNameNorm);
    
    // Or if the product name is like "Tirzepatide", pick the first one? No, Tirzepatide has specific mg variants.
    // Wait, the products table has unique products per mg size?
    // Let's print out what didn't match
    if (bestMatch) {
      mapped++;
      updates.push({ id: ap.id, name: prod.name, old: ap.custom_image_url, new: `/images/savage-brands/${bestMatch}` });
    } else {
      // try to handle cases like "CJC-1295 Without DAC 5mg" -> "cjc1295-without-dac-5mg.jpg"
      // Wait, let's see how many failed.
    }
  }
  
  console.log(`Perfect name mapped ${mapped} out of ${(products||[]).length}`);
  console.log("Unmapped count:", (products||[]).length - mapped);
  
  // Just log a few updates
  console.log(updates.slice(0, 5));
}
main();
