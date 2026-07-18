import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'fs';

const env = {};
readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Check what's actually in product_lots
const { data: lots, error } = await supabase
  .from('product_lots')
  .select('id, product_id, lot_number, coa_storage_key, coa_verified_at, is_active, testing_lab, purity_pct, products(name)')
  .order('products(name)');

if (error) { console.error('ERROR:', error); process.exit(1); }

console.log(`\nTotal product_lots rows: ${lots.length}`);
console.log(`\n=== ROWS WITH coa_storage_key ===`);
lots.filter(l => l.coa_storage_key).forEach(l => console.log('✅', l.products?.name, '|', l.coa_storage_key));

console.log(`\n=== ROWS WITHOUT coa_storage_key (${lots.filter(l=>!l.coa_storage_key).length}) ===`);
lots.filter(l => !l.coa_storage_key).forEach(l => console.log('❌', l.products?.name, '| lot:', l.lot_number, '| verified:', l.coa_verified_at, '| lab:', l.testing_lab));

// Check storage bucket
const { data: files, error: storErr } = await supabase.storage.from('product-coas').list('', { limit: 100 });
console.log(`\n=== product-coas STORAGE BUCKET (${files?.length ?? 0} files) ===`);
if (storErr) console.log('Storage error:', storErr);
(files || []).forEach(f => console.log(' 📄', f.name));
