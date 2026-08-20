require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const apId = '17d6c55c-dafc-41bf-a0f0-b51588c703f2';
  
  const { data: profiles } = await supabase.from('profiles').select('id, role, default_agent_markup_pct, is_super_agent, parent_agent_id');
  const { data: agentProducts } = await supabase.from('agent_products').select('id, agent_id, retail_price, products!inner(base_cost, max_retail_price)').eq('id', apId);

  const profileMap = {};
  for (const p of profiles) profileMap[p.id] = p;

  const ap = agentProducts[0];
  const prof = profileMap[ap.agent_id];
  const baseCost = Number(ap.products.base_cost);
  
  let costBasis = baseCost;
  if (prof.role === 'agent') {
    const parent = prof.parent_agent_id ? profileMap[prof.parent_agent_id] : null;
    if (parent && (parent.role === 'super_agent' || parent.is_super_agent)) {
       const parentMarkup = parent.default_agent_markup_pct != null ? Number(parent.default_agent_markup_pct) : 25;
       costBasis = baseCost * (1 + parentMarkup / 100);
    } else {
       costBasis = baseCost * 1.5;
    }
  } else if (prof.role === 'super_agent' || prof.is_super_agent) {
    costBasis = baseCost;
  }
  
  const myMarkup = prof.default_agent_markup_pct != null ? Number(prof.default_agent_markup_pct) : 50;
  const rawRetail = costBasis * (1 + myMarkup / 100);
  const v_floor = Math.round(costBasis * 1.10 * 100) / 100;
  
  let snappedRetail = Math.round(rawRetail) - 0.03;
  if (snappedRetail < v_floor) {
    snappedRetail = Math.ceil(v_floor) - 0.03;
    if (snappedRetail < v_floor) snappedRetail += 1.00;
  }
  
  console.log(`Sending retail_price = ${snappedRetail}`);
  const { data, error } = await supabase.from('agent_products').update({ retail_price: snappedRetail }).eq('id', ap.id).select('retail_price, margin_percent, updated_at');
  console.log('Result:', data, error);
}
run();
