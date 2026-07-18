import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'fs';

const env = {};
readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: agent } = await supabase.from('agent_profiles').select('id').eq('slug', 'researchstore').maybeSingle();
const { data: agentProds } = await supabase.from('agent_products').select('product_id, products(id, name)').eq('agent_id', agent?.id).limit(50);
const productIds = (agentProds || []).map(p => p.product_id).filter(Boolean);

const { data: lots } = await supabase
  .from('product_lots')
  .select('product_id, lot_number, coa_verified_at, is_active, coa_retracted_at, superseded_by')
  .in('product_id', productIds)
  .eq('is_active', true)
  .not('coa_verified_at', 'is', null)
  .is('coa_retracted_at', null)
  .is('superseded_by', null);

const withCoa = new Set((lots || []).map(l => l.product_id));

console.log('\n=== PRODUCTS WITHOUT COA IN researchstore ===');
(agentProds || []).forEach(p => {
  if (!withCoa.has(p.product_id)) {
    console.log('❌', p.products?.name || p.product_id);
  }
});

// Check specifically for Furnace Stack — look at ALL lots regardless of filters
const furnace = (agentProds || []).find(p => p.products?.name?.includes('Furnace'));
if (furnace) {
  console.log('\n=== Furnace Stack product_id:', furnace.product_id);
  const { data: allFurnaceLots } = await supabase
    .from('product_lots')
    .select('*')
    .eq('product_id', furnace.product_id);
  console.log('All lots:', allFurnaceLots?.length);
  allFurnaceLots?.forEach(l => console.log('  lot:', l.lot_number, '| is_active:', l.is_active, '| verified:', l.coa_verified_at, '| retracted:', l.coa_retracted_at, '| superseded_by:', l.superseded_by));
}
