import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const MAN_MAP: Record<string, string> = {
  'cjc-1295-without-dac-cnd10.png': 'cjc1295-without-dac-10mg.jpg',
  'cjc-1295-without-dac-cnd5.png': 'cjc1295-without-dac-5mg.jpg',
  'ghrp-6-acetate-g610.png': 'ghrp6-10mg.jpg',
  'ghrp-6-acetate-g65.png': 'ghrp6-5mg.jpg',
  'mots-c-ms40.png': 'motsc-40mg.jpg',
  'mots-c-ms10.png': 'motsc-10mg.jpg',
  'l-carnitine-blend-multi-ingredient-lc216.png': 'stack-furnace-1vial.jpg', // Is this furnace?
  'nad-nj500.png': 'nad-100mg.jpg',
  'nad-nj1000.png': 'nad-100mg.jpg',
  'nad-nj100.png': 'nad-100mg.jpg',
  'ara290-cibinetide-ra10.png': 'ara290-10mg.jpg',
  'hgh-fragment-176-191-fr5.png': 'hgh-fragment-5mg.jpg',
  'ghrp-2-acetate-g25.png': 'ghrp2-5mg.jpg',
  'ghrp-2-acetate-g210.png': 'ghrp2-10mg.jpg',
  'glow-tb10-bpc10-ghk50-bbg70.png': 'stack-glow-1vial.jpg',
  'ghk-cu-cu100.png': 'ghkcu-100mg.jpg',
  'ghk-cu-cu.png': 'ghkcu-50mg.jpg',
  'bpc-10mg-tb-10mg-bb20.png': 'stack-ultimate-recovery.jpg', // wait
  'lemon-bottle-le10.png': 'lipolysis-stack-10ml.jpg',
  'l-carnitine-lc600.png': 'stack-furnace-1vial.jpg',
  'igf-1lr3-ig1.png': 'igf1-lr3-1mg.jpg',
  'igf-1lr3-ig01.png': 'igf1-lr3-01mg.jpg',
  'ahk-cu-au100.png': 'ahkcu-100mg.jpg',
  'ahk-cu-au.png': 'ahkcu-50mg.jpg',
  'kisspeptin-10-ks10.png': 'kisspeptin10-10mg.jpg',
  'kisspeptin-10-ks5.png': 'kisspeptin10-5mg.jpg',
  'cagrilintide-5mg-semaglutide-5mg-cs10.png': 'stack-appetite-crusher-2vial.jpg',
  'cjc-1295-without-dac-5mg-ipa-5mg-cp10.png': 'stack-gh-synergy-1vial.jpg',
  'cjc-1295-with-dac-cd5.png': 'cjc1295-with-dac-5mg.jpg',
  'foxo4-dri-f410.png': 'foxo4dri-10mg.jpg',
  'bpc-5mg-tb-5mg-bb10.png': 'stack-ultimate-recovery.jpg',
  'lipo-c-lc10.png': 'skinny-shot-10ml.jpg',
  'the-limitless-stack-semax-selank.png': 'stack-limitless.jpg',
  'shred-stack.png': 'savage-shredder-stack.jpg'
};

async function main() {
  let hasMore = true;
  let offset = 0;
  
  const files = fs.readdirSync(path.join(process.cwd(), 'public', 'images', 'savage-brands'));
  const jpgs = files.filter(f => f.endsWith('.jpg'));

  let mapped = 0;

  while(hasMore) {
      const { data: products } = await supabase.from('agent_products').select('id, custom_image_url, products!inner(id, name, compound_slug)')
        .like('custom_image_url', '%.png')
        .range(offset, offset + 999);
        
      if (!products || products.length === 0) {
          hasMore = false;
          break;
      }
      
      for (const ap of products) {
        const custom = ap.custom_image_url;
        if (!custom || custom.endsWith('.jpg')) continue;
        
        const filename = custom.split('/').pop() || '';
        
        let match = MAN_MAP[filename] || '';
        
        if (!match) {
            const slug = (ap.products as any).compound_slug;
            if (slug) {
                match = jpgs.find(j => j.startsWith(slug + '-') || j === slug + '.jpg' || j.replace(/-/g, '').startsWith(slug.replace(/-/g, '') + '-')) || '';
            }
            if (!match) {
                const base = filename.replace(/\-[a-z0-9]+$/, ''); 
                match = jpgs.find(j => j.startsWith(base)) || '';
            }
        }
        
        if (match) {
            const newUrl = `/images/savage-brands/${match}`;
            const { error } = await supabase.from('agent_products').update({ custom_image_url: newUrl }).eq('id', ap.id);
            if (error) console.error("Error updating", ap.id, error);
            mapped++;
        }
      }
      offset += 1000;
  }
  console.log(`Mapped and updated globally ${mapped}`);
}
main();
