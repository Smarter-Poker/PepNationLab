require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: profiles } = await supabase.from('profiles').select('id, role, default_agent_markup_pct, is_super_agent, parent_agent_id');
  const { data: agentProducts } = await supabase.from('agent_products').select('id, agent_id, product_id, products!inner(base_cost, max_retail_price)');

  // 1. Lift ALL ceilings again just to be absolutely sure.
  for (const ap of agentProducts) {
     if (ap.agent_id === 'b8bd12e6-8196-401e-b37b-f742caf1596c') {
        const newRetail = Math.round(Number(ap.products.base_cost) * 100) - 0.03;
        await supabase.from('agent_products').update({ retail_price: newRetail }).eq('id', ap.id);
     }
  }

  const profileMap = {};
  for (const p of profiles) profileMap[p.id] = p;

  // Split products by role
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
    
    // We get the TRUE v_cost from the database!
    // Since we process super agents first, their v_cost will just be base_cost.
    // When we process normal agents, their super agent parent has ALREADY been updated, so v_cost will be correct!
    const { data: v_cost } = await supabase.rpc('fn_agent_chain_cost', { p_agent: ap.agent_id, p_product: ap.product_id });
    
    if (!v_cost || v_cost <= 0) continue;
    
    const myMarkup = prof.default_agent_markup_pct != null ? Number(prof.default_agent_markup_pct) : 50;
    
    // Calculate raw retail based on the TRUE chain cost and their desired markup
    const rawRetail = v_cost * (1 + myMarkup / 100);
    
    const v_floor = Math.round(v_cost * 1.10 * 100) / 100;
    
    let snappedRetail = Math.round(rawRetail) - 0.03;
    if (snappedRetail < v_floor) {
      snappedRetail = Math.ceil(v_floor) - 0.03;
      if (snappedRetail < v_floor) snappedRetail += 1.00;
    }
    
    const { error: upErr } = await supabase.from('agent_products').update({ retail_price: snappedRetail }).eq('id', ap.id);
    if (upErr) {
      console.error('Failed on', ap.id, upErr.message);
    } else {
      updated++;
    }
  }
  console.log(`Updated ${updated} products.`);
}

run();
