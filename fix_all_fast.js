require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: profiles } = await supabase.from('profiles').select('id, role, default_agent_markup_pct, is_super_agent, parent_agent_id');
  
  let agentProducts = [];
  let from = 0;
  const limit = 1000;
  while (true) {
     const { data } = await supabase.from('agent_products').select('id, agent_id, product_id, products!inner(base_cost, max_retail_price)').range(from, from + limit - 1);
     if (!data || data.length === 0) break;
     agentProducts.push(...data);
     from += limit;
  }
  
  const profileMap = {};
  for (const p of profiles) profileMap[p.id] = p;

  const superAgents = [];
  const normalAgents = [];
  
  for (const ap of agentProducts) {
    if (ap.agent_id === 'b8bd12e6-8196-401e-b37b-f742caf1596c') continue; 
    const prof = profileMap[ap.agent_id];
    if (!prof) continue;
    
    if (prof.role === 'super_agent' || prof.is_super_agent || prof.parent_agent_id == null) {
      superAgents.push(ap);
    } else {
      normalAgents.push(ap);
    }
  }

  await processListFast(superAgents, profileMap, supabase);
  await processListFast(normalAgents, profileMap, supabase);
  console.log('Done fast!');
}

async function processListFast(list, profileMap, supabase) {
  // We can evaluate fn_agent_chain_cost in parallel chunks of 50
  for (let i = 0; i < list.length; i += 50) {
    const chunk = list.slice(i, i + 50);
    
    const promises = chunk.map(async ap => {
       const prof = profileMap[ap.agent_id];
       const originalBaseCost = Number(ap.products.base_cost) / 1.35;
       let originalChainCost = originalBaseCost;
       
       if (prof.role === 'agent') {
         const parent = prof.parent_agent_id ? profileMap[prof.parent_agent_id] : null;
         if (parent && (parent.role === 'super_agent' || parent.is_super_agent)) {
            const parentMarkup = parent.default_agent_markup_pct != null ? Number(parent.default_agent_markup_pct) : 25;
            originalChainCost = originalBaseCost * (1 + parentMarkup / 100);
         } else {
            originalChainCost = originalBaseCost * 1.5;
         }
       }
       
       const myMarkup = prof.default_agent_markup_pct != null ? Number(prof.default_agent_markup_pct) : 50;
       const rawRetail = originalChainCost * (1 + myMarkup / 100);
       let targetOldRetail = Math.round(rawRetail) - 0.03;
       
       const { data: current_v_cost } = await supabase.rpc('fn_agent_chain_cost', { p_agent: ap.agent_id, p_product: ap.product_id });
       if (!current_v_cost || current_v_cost <= 0) return;
       
       const current_v_floor = Math.round(current_v_cost * 1.10 * 100) / 100;
       let finalRetail = targetOldRetail;
       if (finalRetail < current_v_floor) {
         finalRetail = Math.ceil(current_v_floor) - 0.03;
         if (finalRetail < current_v_floor) finalRetail += 1.00;
       }
       
       await supabase.from('agent_products').update({ retail_price: finalRetail }).eq('id', ap.id);
    });
    await Promise.all(promises);
  }
}

run();
