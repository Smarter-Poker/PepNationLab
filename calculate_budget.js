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

async function run() {
  const { data: products } = await supabase.from('products').select('sku, name, base_cost, unit_size, unit_measure').in('sku', targetSkus);
  
  if (!products) {
    console.log("No products found");
    return;
  }
  
  let totalCostPer1Unit = 0;
  for (const p of products) {
    totalCostPer1Unit += (p.base_cost || 0);
  }
  
  // BAC Water is 1:1, so for every 1 unit of peptide, we need 1 unit of BAC water.
  // Actually we need 1 unit of each peptide (24 total) + 24 units of BAC water.
  const bacWater = products.find(p => p.sku === 'BA10');
  const bacWaterCost = bacWater ? bacWater.base_cost || 0 : 0;
  
  // Cost for 1 unit of EVERY peptide + 1 unit of BAC water for each
  let costOfOneSet = 0;
  for (const p of products) {
    if (p.sku !== 'BA10') {
      costOfOneSet += (p.base_cost || 0) + bacWaterCost;
    }
  }
  
  const budget = 10000;
  const setsWeCanBuy = Math.floor(budget / costOfOneSet);
  
  console.log(`Cost of 1 unit of every peptide + matching BAC water: $${costOfOneSet}`);
  console.log(`With a budget of $10,000, we can buy ${setsWeCanBuy} units of each peptide.`);
  console.log(`Total cost will be $${setsWeCanBuy * costOfOneSet}`);
  console.log("--- Itemized Costs ---");
  products.forEach(p => console.log(`${p.sku} (${p.name}): $${p.base_cost}`));
}

run();
