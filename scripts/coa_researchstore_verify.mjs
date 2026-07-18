import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'fs';

const env = {};
readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Get the researchstore agent ID
const { data: agent } = await supabase.from('agent_profiles').select('id').eq('slug', 'researchstore').maybeSingle();
console.log('Agent:', agent?.id);

// Get product IDs for the researchstore
const { data: agentProds } = await supabase.from('agent_products').select('product_id').eq('agent_id', agent?.id).limit(20);
const productIds = (agentProds || []).map(p => p.product_id).filter(Boolean);
console.log('Product IDs count:', productIds.length);

// Run the exact same query as the fixed page.tsx
const { data: lots, error } = await supabase
  .from('product_lots')
  .select('product_id, lot_number, coa_storage_key, received_at, products(name)')
  .in('product_id', productIds)
  .eq('is_active', true)
  .not('coa_verified_at', 'is', null)
  .is('coa_retracted_at', null)
  .is('superseded_by', null)
  .order('received_at', { ascending: false });

if (error) { console.error('Query error:', error); process.exit(1); }
console.log('\nLots found:', lots?.length || 0);

const coaByProductId = {};
for (const row of lots ?? []) {
  if (coaByProductId[row.product_id]) continue;
  if (row.lot_number) {
    coaByProductId[row.product_id] = `/coa?lot=${encodeURIComponent(row.lot_number)}`;
  }
}

console.log('\ncoaByProductId entries:', Object.keys(coaByProductId).length);
Object.entries(coaByProductId).slice(0, 5).forEach(([pid, url]) => {
  const prod = lots?.find(l => l.product_id === pid);
  console.log('  ✅', prod?.products?.name || pid.slice(0,8), '→', url);
});
