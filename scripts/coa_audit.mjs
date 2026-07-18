import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'fs';

const env = {};
try {
  readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  });
} catch {}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: withCoa } = await supabase
  .from('product_lots')
  .select('product_id, coa_storage_key, products(name)')
  .eq('is_active', true)
  .not('coa_storage_key', 'is', null);

const { data: allProducts } = await supabase
  .from('products')
  .select('id, name')
  .eq('is_active', true)
  .order('name');

const withCoaIds = new Set();
const withCoaNames = [];
(withCoa || []).forEach(r => {
  if (!withCoaIds.has(r.product_id)) {
    withCoaIds.add(r.product_id);
    withCoaNames.push(r.products?.name || r.product_id);
  }
});

const missingCoa = (allProducts || []).filter(p => !withCoaIds.has(p.id)).map(p => p.name);

console.log('\n=== PRODUCTS WITH A COA (' + withCoaNames.length + ') ===');
withCoaNames.sort().forEach(n => console.log('  ✅ ' + n));

console.log('\n=== PRODUCTS MISSING A COA (' + missingCoa.length + ') ===');
missingCoa.forEach(n => console.log('  ❌ ' + n));

console.log('\nSummary: ' + withCoaIds.size + ' have COA / ' + (allProducts||[]).length + ' total active products');
