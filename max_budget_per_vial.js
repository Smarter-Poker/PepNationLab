require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const targetSkus = [
  'TR10', 'TR20', 'SM10', 'SM20', 'BC10', 'BT10', 'RT10', 'RT20', 'TSM10', 'TSM20',
  'CND10', 'IP10', '10AD', 'MS10', 'P41', 'CU', 'TA10', 'ET10', 'DS10', 'KS10',
  'SK10', 'XA10', 'BB20', 'CP10', 'BA10',
  'K80', 'BBG70', 'NP810', 'MT1'
];

async function run() {
  const { data: products } = await supabase.from('products').select('sku, name, base_cost, unit_size, unit_measure').in('sku', targetSkus);
  const bacWater = products.find(p => p.sku === 'BA10');
  // DB stores price per 10-pack. Divide by 10 to get per-vial cost.
  const bacWaterCost = bacWater ? (bacWater.base_cost / 10) : 0;
  const peptides = products.filter(p => p.sku !== 'BA10');
  
  // Start with 10 of everything as a baseline
  let quantities = {};
  peptides.forEach(p => quantities[p.sku] = 10);
  
  function getCost() {
    let total = 0;
    peptides.forEach(p => {
      total += quantities[p.sku] * ((p.base_cost / 10) + bacWaterCost);
    });
    return total;
  }

  // Priority queue of SKUs to add (Top Sellers get more)
  const priority = ['TR20', 'TR10', 'SM20', 'SM10', 'BC10', 'BT10', 'RT20', 'RT10', 'CU', 'IP10', 'K80', 'BBG70', 'NP810', 'MT1'];
  
  let budget = 10000;
  
  while (getCost() < budget) {
    let added = false;
    for (let sku of priority) {
      const p = peptides.find(x => x.sku === sku);
      if (getCost() + (p.base_cost / 10) + bacWaterCost <= budget) {
        quantities[sku] += 5; // increment by 5 vials at a time for speed
        if (getCost() > budget) {
           quantities[sku] -= 5;
           // Try adding 1
           if (getCost() + (p.base_cost / 10) + bacWaterCost <= budget) {
             quantities[sku] += 1;
             added = true;
           }
        } else {
           added = true;
        }
      }
    }
    // If we can't add priority, try adding any
    if (!added) {
      for (let p of peptides) {
        if (getCost() + (p.base_cost / 10) + bacWaterCost <= budget) {
          quantities[p.sku]++;
          added = true;
          break;
        }
      }
    }
    if (!added) break; // can't fit anything else
  }
  
  let finalCost = getCost();
  console.log("Quantities:");
  let totalPeptides = 0;
  let markdown = "";
  peptides.forEach(p => {
    let qty = quantities[p.sku];
    totalPeptides += qty;
    let unitCost = p.base_cost / 10;
    let extCost = unitCost * qty;
    markdown += `| **${p.sku}** | ${p.name} | ${p.unit_size}${p.unit_measure || ''} | ${qty} | $${unitCost.toFixed(2)} | $${extCost.toFixed(2)} |\n`;
  });
  console.log(markdown);
  console.log(`BAC Water: ${totalPeptides} | Unit: $${bacWaterCost.toFixed(2)} | $${(totalPeptides * bacWaterCost).toFixed(2)}`);
  console.log("Total:", finalCost.toFixed(2));
}

run();
