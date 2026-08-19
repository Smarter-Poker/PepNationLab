import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function getBase(name: string) {
  return name.replace('.png', '').replace('-v2', '').replace(/\-[a-z0-9]+$/, ''); 
}

async function main() {
  const { data: agent } = await supabase.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  const { data: products } = await supabase.from('agent_products').select('id, custom_image_url, products!inner(id, name, compound_slug)').eq('agent_id', agent?.id);

  const files = fs.readdirSync(path.join(process.cwd(), 'public', 'images', 'savage-brands'));
  const jpgs = files.filter(f => f.endsWith('.jpg'));

  let mapped = 0;
  for (const ap of products || []) {
    const custom = ap.custom_image_url;
    if (!custom || custom.endsWith('.jpg')) continue;
    
    const filename = custom.split('/').pop() || '';
    
    // Strategy 1: Slug match against JPGs
    const slug = (ap.products as any).compound_slug;
    let match = jpgs.find(j => j.startsWith(slug + '-') || j === slug + '.jpg' || j.replace(/-/g, '').startsWith(slug.replace(/-/g, '') + '-'));
    
    // Strategy 2: Base of PNG filename
    if (!match) {
        const base = filename.replace(/\-[a-z0-9]+$/, ''); // Strip -ot5, -cnd10 etc
        match = jpgs.find(j => j.startsWith(base));
    }
    
    if (match) {
        console.log(`Mapped: ${filename} -> ${match}`);
        mapped++;
    } else {
        console.log(`FAIL: ${filename} (Product: ${(ap.products as any).name}, Slug: ${slug})`);
    }
  }
  console.log(`Mapped ${mapped}`);
}
main();
