#!/usr/bin/env node
/**
 * set-product-images-db.mjs
 * Sets the correct /images/products/xxx.png URL on every product row in Supabase.
 * Runs a CASE-insensitive match on product name → new image path.
 */

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ydsaqnnuwyvtyxgvrnys.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI',
  { auth: { persistSession: false } }
);

// Map: substring match (lowercase) → new image path
const NAME_TO_IMAGE = [
  // Weight Loss — RED cap
  ['tirzepatide',           '/images/products/tirzepatide.png'],
  ['semaglutide',           '/images/products/semaglutide.png'],
  ['retatrutide',           '/images/products/retatrutide.png'],
  ['survotutide',           '/images/products/retatrutide.png'],  // closest match
  ['lemon bottle',          '/images/products/lemon-bottle.png'],
  ['l-carnitine blend',     '/images/products/l-carnitine-blend.png'],
  ['l-carnitine',           '/images/products/l-carnitine.png'],
  ['aod9604',               '/images/products/aod-9604.png'],
  ['aod-9604',              '/images/products/aod-9604.png'],
  ['hgh fragment',          '/images/products/hgh-fragment-176-191.png'],
  ['fragment 176',          '/images/products/hgh-fragment-176-191.png'],
  ['cagrilintide and sema', '/images/products/cagrilintide-sema.png'],
  ['cagri / sema',          '/images/products/cagrilintide-sema.png'],
  ['cagrilintide',          '/images/products/cagrilintide.png'],
  ['liraglutide',           '/images/products/liraglutide.png'],
  ['5-amino-1mq',           '/images/products/5-amino-1mq.png'],
  ['5 amino 1mq',           '/images/products/5-amino-1mq.png'],
  ['lipo-c',                '/images/products/lipo-c.png'],
  ['mots-c',                '/images/products/mots-c.png'],
  ['tesamorelin',           '/images/products/tesamorelin.png'],

  // Healing — TEAL cap
  ['bpc 10mg + tb 10mg',    '/images/products/bpc-tb-blend.png'],
  ['bpc-157 and tb',        '/images/products/bpc-tb-blend.png'],
  ['bpc 10mg + tb',         '/images/products/bpc-tb-blend.png'],
  ['bpc-157',               '/images/products/bpc-157.png'],
  ['bpc 157',               '/images/products/bpc-157.png'],
  ['tb500',                 '/images/products/tb-500.png'],
  ['thymosin b4',           '/images/products/tb-500.png'],
  ['kpv',                   '/images/products/kpv.png'],
  ['thymosin alpha',        '/images/products/thymosin-alpha-1.png'],
  ['thymalin',              '/images/products/thymosin-alpha-1.png'],
  ['ll37',                  '/images/products/ll-37.png'],
  ['ll-37',                 '/images/products/ll-37.png'],
  ['dsip',                  '/images/products/dsip.png'],
  ['larazotide',            '/images/products/larazotide.png'],

  // Growth Hormone — GOLD cap
  ['hmg',                   '/images/products/hmg.png'],
  ['sermorelin acetate',    '/images/products/sermorelin-acetate.png'],
  ['sermorelin',            '/images/products/sermorelin.png'],
  ['cjc-1295 without dac',  '/images/products/cjc-1295-ipa.png'],
  ['cjc-1295 / ipa',        '/images/products/cjc-1295-ipa.png'],
  ['cjc-1295 with dac',     '/images/products/cjc-1295-dac.png'],
  ['cjc-1295 dac',          '/images/products/cjc-1295-dac.png'],
  ['ipamorelin',            '/images/products/ipamorelin.png'],
  ['ghrp-2',                '/images/products/ghrp-2.png'],
  ['ghrp-6',                '/images/products/ghrp-6.png'],
  ['hexarelin',             '/images/products/hexarelin.png'],
  ['mod grf',               '/images/products/mod-grf-1-29.png'],
  ['humanin',               '/images/products/humanin.png'],
  ['hgh 191',               '/images/products/sermorelin.png'],
  ['somatropin',            '/images/products/sermorelin.png'],

  // Muscle Growth — BLUE cap
  ['igf-1',                 '/images/products/igf-1-lr3.png'],
  ['igf1',                  '/images/products/igf-1-lr3.png'],
  ['peg-mgf',               '/images/products/peg-mgf.png'],
  ['pegmgf',                '/images/products/peg-mgf.png'],
  ['follistatin',           '/images/products/follistatin-344.png'],
  ['mgf',                   '/images/products/mgf.png'],

  // Sexual Health — PURPLE cap
  ['pt-141',                '/images/products/pt-141.png'],
  ['bremelanotide',         '/images/products/pt-141.png'],
  ['oxytocin',              '/images/products/oxytocin.png'],
  ['kisspeptin',            '/images/products/kisspeptin-10.png'],
  ['hcg',                   '/images/products/oxytocin.png'],   // best fallback

  // Anti-Aging — ROSE GOLD cap
  ['ghk-cu',                '/images/products/ghk-cu.png'],
  ['ghk cu',                '/images/products/ghk-cu.png'],
  ['epithalon',             '/images/products/epithalon.png'],
  ['epitalon',              '/images/products/epithalon.png'],
  ['nad+',                  '/images/products/nad-plus.png'],
  ['nad ',                  '/images/products/nad-plus.png'],
  ['glutathione',           '/images/products/glutathione.png'],
  ['vitamin b',             '/images/products/vitamin-b12.png'],
  ['b12',                   '/images/products/vitamin-b12.png'],
  ['melatonin',             '/images/products/pinealon.png'],   // best fallback
  ['pinealon',              '/images/products/pinealon.png'],
  ['vilon',                 '/images/products/vilon.png'],
  ['ss-31',                 '/images/products/epithalon.png'],  // best fallback

  // Skin / Cosmetics — GREEN cap
  ['mt-2',                  '/images/products/mt-2.png'],
  ['mt-1',                  '/images/products/mt-2.png'],
  ['melanotan',             '/images/products/mt-2.png'],
  ['glow',                  '/images/products/glow-blend.png'],
  ['klow',                  '/images/products/klow-blend.png'],
  ['snap-8',                '/images/products/snap-8.png'],
  ['snap8',                 '/images/products/snap-8.png'],

  // Nootropics — SILVER cap
  ['selank',                '/images/products/selank.png'],
  ['semax',                 '/images/products/semax.png'],
  ['dihexa',                '/images/products/dihexa.png'],
  ['vip',                   '/images/products/pinealon.png'],   // best fallback
];

function getImageForName(name) {
  const lower = name.toLowerCase();
  for (const [key, img] of NAME_TO_IMAGE) {
    if (lower.includes(key)) return img;
  }
  return null;
}

async function main() {
  console.log('\n🔧 Setting product image URLs in Supabase...\n');

  const { data: products, error } = await sb
    .from('products')
    .select('id, name, image_url');

  if (error) { console.error('Fetch error:', error.message); return; }

  console.log(`Found ${products.length} product rows\n`);

  let updated = 0; let skipped = 0; let failed = 0;

  for (const product of products) {
    const newImg = getImageForName(product.name);
    if (!newImg) {
      console.log(`  ⚠️  No match: "${product.name}"`);
      skipped++;
      continue;
    }

    const { error: updateErr } = await sb
      .from('products')
      .update({ image_url: newImg })
      .eq('id', product.id);

    if (updateErr) {
      console.error(`  ❌ "${product.name}": ${updateErr.message}`);
      failed++;
    } else {
      console.log(`  ✅  "${product.name}" → ${newImg}`);
      updated++;
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`✅ Updated : ${updated}`);
  console.log(`⚠️  Skipped : ${skipped}`);
  console.log(`❌ Failed  : ${failed}`);
  console.log('════════════════════════════════════════\n');
}

main().catch(console.error);
