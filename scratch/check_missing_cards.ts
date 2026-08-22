import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');

async function main() {
  const { data: products } = await supabase.from('products').select('name, compound_slug');
  const cards = fs.readdirSync(path.join(process.cwd(), 'public/images/storefront/savagebrands/'));
  
  for (const p of products || []) {
      if (!p.compound_slug) continue;
      const cardName = `${p.compound_slug}-card.jpg`;
      if (!cards.includes(cardName)) {
          console.log(`Missing card for slug: ${p.compound_slug} (Product: ${p.name})`);
      }
  }
}
main();
