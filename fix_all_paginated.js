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
  
  console.log(`Fetched ${agentProducts.length} agent products.`);

  // Lift ceilings
  const adminProducts = agentProducts.filter(ap => ap.agent_id === 'b8bd12e6-8196-401e-b37b-f742caf1596c');
  for (const ap of adminProducts) {
     const newRetail = Math.round(Number(ap.products.base_cost) * 100) - 0.03;
     await supabase.from('agent_products').update({ retail_price: newRetail }).eq('id', ap.id);
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

  console.log(`Processing ${superAgents.length} super agents...`);
  await processList(superAgents, profileMap, supabase);

  console.log(`Processing ${normalAgents.length} downline agents...`);
  await processList(normalAgents, profileMap, supabase);
  
  console.log('Done!');
}

async function processList(list, profileMap, supabase) {
  let updated = 0;
  for (const ap of list) {
    const prof = profileMap[ap.agent_id];
    
    // For calculating the target original price, we must use the original base cost!
    // The user increased the base cost by 35%. So old base cost = current base cost / 1.35
    const originalBaseCost = Number(ap.products.base_cost) / 1.35;
    
    // To get the EXACT old price, we need to know what markup they used originally.
    // If we just use default_agent_markup_pct, we will get the exact .97 price they had before!
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
    
    // The exact .97 price they used to have:
    let targetOldRetail = Math.round(rawRetail) - 0.03;
    
    // Now we must ensure that targetOldRetail satisfies the CURRENT v_floor!
    // Wait, the user said "PROFIT MARGIN % SHOULD GO DOWN".
    // If we just set retail_price to targetOldRetail, will it satisfy the current floor?
    // Let's get the current v_cost
    const { data: current_v_cost } = await supabase.rpc('fn_agent_chain_cost', { p_agent: ap.agent_id, p_product: ap.product_id });
    
    if (!current_v_cost || current_v_cost <= 0) continue;
    
    const current_v_floor = Math.round(current_v_cost * 1.10 * 100) / 100;
    
    let finalRetail = targetOldRetail;
    if (finalRetail < current_v_floor) {
      finalRetail = Math.ceil(current_v_floor) - 0.03;
      if (finalRetail < current_v_floor) finalRetail += 1.00;
    }
    
    const { error: upErr } = await supabase.from('agent_products').update({ retail_price: finalRetail }).eq('id', ap.id);
    if (upErr) {
      console.error('Failed on', ap.id, upErr.message);
    } else {
      updated++;
    }
  }
  console.log(`Updated ${updated} products.`);
}

run();
