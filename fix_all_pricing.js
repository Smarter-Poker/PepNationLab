require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, role, default_agent_markup_pct, is_super_agent, parent_agent_id');
  if (pErr) throw pErr;
  
  const { data: agentProducts, error: apErr } = await supabase.from('agent_products').select('id, agent_id, products!inner(base_cost)');
  if (apErr) throw apErr;

  const profileMap = {};
  for (const p of profiles) profileMap[p.id] = p;

  let updated = 0;
  for (const ap of agentProducts) {
    if (ap.agent_id === 'b8bd12e6-8196-401e-b37b-f742caf1596c') continue; // Skip admin store (we already lifted the ceiling)
    
    const prof = profileMap[ap.agent_id];
    if (!prof) continue;

    const baseCost = Number(ap.products.base_cost);
    
    // Determine the cost basis for this agent based on their tier
    let costBasis = baseCost;
    if (prof.role === 'agent') {
      const parent = prof.parent_agent_id ? profileMap[prof.parent_agent_id] : null;
      if (parent && (parent.role === 'super_agent' || parent.is_super_agent)) {
         // Sub-agent of super agent: cost is base_cost + super_agent's default markup (or just use 1.25 as an average if parent markup is 25%)
         // The standard platform logic is: super agent gets base_cost, agent gets base_cost * (1 + parent_markup)
         const parentMarkup = parent.default_agent_markup_pct != null ? Number(parent.default_agent_markup_pct) : 25;
         costBasis = baseCost * (1 + parentMarkup / 100);
      } else {
         // Direct agent under admin
         costBasis = baseCost * 1.5; // Standard 50% house markup for direct agents
      }
    } else if (prof.role === 'super_agent' || prof.is_super_agent) {
      costBasis = baseCost;
    }
    
    const myMarkup = prof.default_agent_markup_pct != null ? Number(prof.default_agent_markup_pct) : 50;
    
    // Raw calculated retail
    const rawRetail = costBasis * (1 + myMarkup / 100);
    
    // Snap to .97
    let snappedRetail = Math.round(rawRetail) - 0.03;
    if (snappedRetail < rawRetail) {
      snappedRetail += 1.00;
    }
    
    const newMargin = Math.round(((snappedRetail / costBasis) - 1) * 100 * 100) / 100;

    await supabase.from('agent_products').update({ retail_price: snappedRetail, margin_percent: newMargin }).eq('id', ap.id);
    updated++;
  }
  
  console.log(`Reset ${updated} agent products to mathematical .97 pricing based on default markups.`);
}
run();
