const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const newPrices = {
  "TR10": 47,
  "TR20": 70,
  "SM10": 47,
  "SM20": 66,
  "BC10": 59,
  "BT10": 142,
  "RT10": 83,
  "RT20": 106,
  "K80": 200,
  "BBG70": 180,
  "CP10": 100,
  "IP10": 59,
  "CU": 28,
  "MT1": 46,
  "NP810": 37,
  "TSM10": 168,
  "TSM20": 325,
  "CND10": 135,
  "10AD": 153, 
  "MS10": 59,
  "P41": 58,
  "TA10": 142,
  "ET10": 34,
  "DS10": 73,
  "KS10": 91,
  "SK10": 68,
  "XA10": 68,
  "BA10": 11
};

const targetSkus = [
  'TR10', 'TR20', 'SM10', 'SM20', 'BC10', 'BT10', 'RT10', 'RT20', 'TSM10', 'TSM20',
  'CND10', 'IP10', '10AD', 'MS10', 'P41', 'CU', 'TA10', 'ET10', 'DS10', 'KS10',
  'SK10', 'XA10', 'CP10', 'NP810', 'MT1', 'K80', 'BBG70' 
];

async function run() {
  console.log("Updating prices...");
  for (const [sku, price] of Object.entries(newPrices)) {
    const { error } = await supabase
      .from('products')
      .update({ base_cost: price })
      .eq('sku', sku);
    if (error) {
      console.error(`Error updating ${sku}:`, error);
    }
  }
  console.log("Prices updated successfully.");

  console.log("Fetching updated products...");
  const { data: products, error } = await supabase.from('products').select('sku, name, base_cost, unit_size, unit_measure').in('sku', [...targetSkus, 'BA10']);
  
  if (error) {
    console.error("Error fetching products:", error);
    return;
  }

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

  // Priority queue
  const priority = ['TR20', 'TR10', 'SM20', 'SM10', 'BC10', 'BT10', 'RT20', 'RT10', 'CU', 'IP10', 'K80', 'BBG70', 'NP810', 'MT1'];
  
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
  let markdown = "| SKU | Product Name | Size | Qty | Unit Cost | Ext Cost |\n|---|---|---|---|---|---|\n";
  
  // Sort peptides like the original list
  targetSkus.forEach(sku => {
    let p = peptides.find(x => x.sku === sku);
    if (!p) return;
    let qty = quantities[p.sku];
    totalPeptides += qty;
    let unitCost = p.base_cost / 10;
    let extCost = unitCost * qty;
    markdown += `| **${p.sku}** | ${p.name} | ${p.unit_size}${p.unit_measure || ''} | ${qty} | $${unitCost.toFixed(2)} | $${extCost.toFixed(2)} |\n`;
  });
  
  let bacWaterQty = Math.ceil((totalPeptides / 3) / 10) * 10;
  markdown += `| **BA10** | BAC Water | 10ml | ${bacWaterQty} | $${bacWaterCost.toFixed(2)} | $${(bacWaterQty * bacWaterCost).toFixed(2)} |\n`;
  
  markdown += `\n**Total Peptide Vials:** ${totalPeptides}  \n`;
  markdown += `**Total BAC Water Vials:** ${bacWaterQty}  \n`;
  markdown += `**Subtotal (Base Cost):** $${finalCost.toFixed(2)}  \n`;

  console.log("Markdown:\n\n" + markdown);
}

run();
