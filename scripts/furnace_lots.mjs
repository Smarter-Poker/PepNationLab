import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'fs';

const env = {};
readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: agent } = await supabase.from('agent_profiles').select('id').eq('slug', 'researchstore').maybeSingle();
const { data: agentProds } = await supabase.from('agent_products').select('product_id, products(id, name, unit_size)').eq('agent_id', agent?.id);
const furnaces = agentProds.filter(p => p.products?.name?.includes('Furnace'));

console.log('Furnace variants found:', furnaces.length);
for (const f of furnaces) {
  console.log(`- ${f.products.name} (${f.products.unit_size}): ${f.product_id}`);
  const { data: lots } = await supabase.from('product_lots').select('*').eq('product_id', f.product_id);
  console.log('  Lots:', lots?.length);
  lots?.forEach(l => console.log('    lot:', l.lot_number, 'is_active:', l.is_active, 'verified:', l.coa_verified_at, 'retracted:', l.coa_retracted_at));
}
