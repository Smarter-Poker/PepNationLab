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
  const bacWaterCost = bacWater ? (bacWater.base_cost / 10) : 0;
  const peptides = products.filter(p => p.sku !== 'BA10');
  
  let quantities = {};
  // Minimum of 20 per peptide
  peptides.forEach(p => quantities[p.sku] = 20);
  
  function getCost() {
    let total = 0;
    let totalPeptides = 0;
    peptides.forEach(p => {
      total += quantities[p.sku] * (p.base_cost / 10);
      totalPeptides += quantities[p.sku];
    });
    // 1 BAC water per 3 peptide vials, rounded up to nearest 10
    let bacWaterQty = Math.ceil((totalPeptides / 3) / 10) * 10;
    return total + (bacWaterQty * bacWaterCost);
  }

  const priority = ['TR20', 'TR10', 'SM20', 'SM10', 'BC10', 'BT10', 'RT20', 'RT10', 'CU', 'IP10', 'K80', 'BBG70', 'NP810', 'MT1'];
  
  let budget = 15000;
  
  while (getCost() < budget) {
    let added = false;
    for (let sku of priority) {
      const p = peptides.find(x => x.sku === sku);
      
      // try adding 10
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
  peptides.forEach(p => totalPeptides += quantities[p.sku]);
  let bacWaterQty = Math.ceil((totalPeptides / 3) / 10) * 10;
  
  console.log(`Total Vials: ${totalPeptides} Peptides + ${bacWaterQty} BAC Water`);
  console.log(`Final Cost: $${finalCost.toFixed(2)}\n`);
  
  // We need to split into 3 $5k orders
  // Let's just output the total quantities, and we'll divide by 3 in the markdown.
  // Wait, if it has to be increments of 10 per order, then total must be increments of 30!
  // Let's modify the script to increment by 30 instead of 10 so it perfectly divides by 3!
  
}
run();
