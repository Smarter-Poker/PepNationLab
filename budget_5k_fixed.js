require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const targetSkus = [
  'TR10', 'TR20', 'SM10', 'SM20', 'BC10', 'BT10', 'RT10', 'RT20', 'TSM10', 'TSM20',
  'CND10', 'IP10', '10AD', 'MS10', 'P41', 'CU', 'TA10', 'ET10', 'DS10', 'KS10',
  'SK10', 'XA10', 'CP10', 'KP10', 'NP810', 'MT1' // Removed K80, BBG70, BB20. Added KP10.
];

async function run() {
  const { data: products } = await supabase.from('products').select('sku, name, base_cost, unit_size, unit_measure').in('sku', [...targetSkus, 'BA10']);
  const bacWater = products.find(p => p.sku === 'BA10');
  const bacWaterCost = bacWater ? (bacWater.base_cost / 10) : 0;
  const peptides = products.filter(p => p.sku !== 'BA10');
  
  let quantities = {};
  peptides.forEach(p => quantities[p.sku] = 10);
  
  function getCost() {
    let total = 0;
    let totalPeptides = 0;
    peptides.forEach(p => {
      total += quantities[p.sku] * (p.base_cost / 10);
      totalPeptides += quantities[p.sku];
    });
    // 1 BAC water per 3 peptide vials, rounded to nearest 10
    let bacWaterQty = Math.ceil((totalPeptides / 3) / 10) * 10;
    return total + (bacWaterQty * bacWaterCost);
  }

  // Gave extra priority to the components of the stacks to make up for their removal
  const priority = ['TR20', 'TR10', 'SM20', 'SM10', 'BC10', 'BT10', 'CU', 'KP10', 'RT20', 'RT10', 'IP10', 'NP810', 'MT1'];
  
  let budget = 5000;
  
  while (getCost() < budget) {
    let added = false;
    for (let sku of priority) {
      quantities[sku] += 10;
      if (getCost() > budget) {
         quantities[sku] -= 10;
      } else {
         added = true;
      }
    }
    
    if (!added) {
      for (let p of peptides) {
        quantities[p.sku] += 10;
        if (getCost() > budget) {
          quantities[p.sku] -= 10;
        } else {
          added = true;
          break;
        }
      }
    }
    if (!added) break;
  }
  
  let finalCost = getCost();
  let totalPeptides = 0;
  let markdown = "";
  peptides.forEach(p => {
    let qty = quantities[p.sku];
    totalPeptides += qty;
    let unitCost = p.base_cost / 10;
    let extCost = unitCost * qty;
    markdown += `| **${p.sku}** | ${p.name} | ${p.unit_size}${p.unit_measure || ''} | ${qty} | $${unitCost.toFixed(2)} | $${extCost.toFixed(2)} |\n`;
  });
  
  let bacWaterQty = Math.ceil((totalPeptides / 3) / 10) * 10;
  markdown += `| **BA10** | BAC Water | 10ml | ${bacWaterQty} | $${bacWaterCost.toFixed(2)} | $${(bacWaterQty * bacWaterCost).toFixed(2)} |\n`;
  
  console.log(`Total Vials: ${totalPeptides} Peptides + ${bacWaterQty} BAC Water`);
  console.log(`Final Cost: $${finalCost.toFixed(2)}\n`);
  console.log("Markdown:\n" + markdown);
}
run();
