require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const targetSkus = [
  'TR10', 'TR20', 'SM10', 'SM20', 'BC10', 'BT10', 'RT10', 'RT20', 'TSM10', 'TSM20',
  'CND10', 'IP10', '10AD', 'MS10', 'P41', 'CU', 'TA10', 'ET10', 'DS10', 'KS10',
  'SK10', 'XA10', 'BB20', 'CP10', 'BA10'
];

// Weighted allocation based on typical popularity
// Tier 1: Semaglutide, Tirzepatide, BPC-157, TB500 (weight 4)
// Tier 2: Retatrutide, Ipamorelin, AOD9604, GHK-CU, MOTS-C (weight 2)
// Tier 3: Everything else (weight 1)
const weights = {
  'TR10': 4, 'TR20': 4, 'SM10': 4, 'SM20': 4, 'BC10': 4, 'BT10': 4,
  'RT10': 2, 'RT20': 2, 'IP10': 2, '10AD': 2, 'CU': 2, 'MS10': 2,
  // Default weight 1 for the rest
};

async function run() {
  const { data: products } = await supabase.from('products').select('sku, name, base_cost, unit_size, unit_measure').in('sku', targetSkus);
  
  if (!products) return;
  
  const bacWater = products.find(p => p.sku === 'BA10');
  const bacWaterCost = bacWater ? bacWater.base_cost || 0 : 0;
  
  const peptides = products.filter(p => p.sku !== 'BA10');
  
  // Calculate total weighted cost
  let totalWeightedCost = 0;
  for (const p of peptides) {
    const w = weights[p.sku] || 1;
    // For each peptide, we also need 1 BAC water
    totalWeightedCost += w * ((p.base_cost || 0) + bacWaterCost);
  }
  
  const budget = 10000;
  // This is the multiplier we can apply to our weights
  const multiplier = Math.floor(budget / totalWeightedCost);
  
  let totalSpent = 0;
  let totalVials = 0;
  
  console.log(`Budget Multiplier: ${multiplier}`);
  
  peptides.forEach(p => {
    const w = weights[p.sku] || 1;
    let qty = w * multiplier;
    // ensure at least 1 unit if it's in the top 20
    if (qty === 0) qty = 1;
    
    const cost = (p.base_cost || 0) * qty;
    const bacCost = bacWaterCost * qty;
    
    totalSpent += cost + bacCost;
    totalVials += qty;
    
    console.log(`${p.sku} | ${p.name} | Qty: ${qty} | Unit Base Cost: $${p.base_cost} | Ext Cost: $${cost}`);
  });
  
  console.log(`\nBAC Water (BA10) Qty: ${totalVials} | Ext Cost: $${totalVials * bacWaterCost}`);
  console.log(`\nTotal Spent: $${totalSpent}`);
  console.log(`Total Vials (Peptides): ${totalVials}`);
}

run();
