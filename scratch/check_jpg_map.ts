import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: agent } = await supabase.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  const { data: products } = await supabase.from('agent_products').select('id, custom_image_url, products!inner(id, name, compound_slug)').eq('agent_id', agent?.id);

  const files = fs.readdirSync(path.join(process.cwd(), 'public', 'images', 'savage-brands'));
  const jpgs = files.filter(f => f.endsWith('.jpg'));

  let mapped = 0;
  for (const ap of products || []) {
    const prod: any = ap.products;
    const slug = prod.compound_slug;
    if (!slug) {
        console.log(`No slug for: ${prod.name}`);
        continue;
    }
    // Find a jpg that starts with the slug
    const matchingJpgs = jpgs.filter(f => f.startsWith(slug + '-') || f === slug + '.jpg' || f === slug.replace(/-/g, '') + '.jpg' || f.startsWith(slug.replace(/-/g, '') + '-'));
    if (matchingJpgs.length > 0) {
      // Pick the first one (or try to match specific logic)
      mapped++;
    } else {
      console.log(`No JPG found for: ${prod.name} (${slug})`);
    }
  }
  console.log(`Mapped ${mapped} out of ${(products||[]).length}`);
}
main();
