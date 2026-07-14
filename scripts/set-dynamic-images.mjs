#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  const productsList = JSON.parse(fs.readFileSync('products_list.json', 'utf8'));
  console.log(`Loaded ${productsList.length} products to update`);

  let updated = 0;
  let failed = 0;

  for (const product of productsList) {
    const newImg = `/images/products/${product.slug}.png`;
    
    const { error: updateErr } = await sb
      .from('products')
      .update({ image_url: newImg })
      .eq('id', product.id);

    if (updateErr) {
      console.error(`❌ Failed to update ${product.name}: ${updateErr.message}`);
      failed++;
    } else {
      console.log(`✅ ${product.name} -> ${newImg}`);
      updated++;
    }
  }

  console.log(`\n✅ Updated: ${updated}\n❌ Failed: ${failed}`);
}

main().catch(console.error);
