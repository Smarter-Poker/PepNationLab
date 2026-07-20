const fs = require('fs');

const products = [
  { sku: 'TR10', name: 'Tirzepatide', unit_size: 10, unit_measure: 'mg', base_cost: 47 },
  { sku: 'TR20', name: 'Tirzepatide', unit_size: 20, unit_measure: 'mg', base_cost: 70 },
  { sku: 'SM10', name: 'Semaglutide', unit_size: 10, unit_measure: 'mg', base_cost: 47 },
  { sku: 'SM20', name: 'Semaglutide', unit_size: 20, unit_measure: 'mg', base_cost: 66 },
  { sku: 'BC10', name: 'BPC 157', unit_size: 10, unit_measure: 'mg', base_cost: 59 },
  { sku: 'BT10', name: 'TB500 (Thymosin B4 Acetate)', unit_size: 10, unit_measure: 'mg', base_cost: 142 },
  { sku: 'RT10', name: 'Retatrutide', unit_size: 10, unit_measure: 'mg', base_cost: 83 },
  { sku: 'RT20', name: 'Retatrutide', unit_size: 20, unit_measure: 'mg', base_cost: 106 },
  { sku: 'TSM10', name: 'Tesamorelin', unit_size: 10, unit_measure: 'mg', base_cost: 168 },
  { sku: 'TSM20', name: 'Tesamorelin', unit_size: 20, unit_measure: 'mg', base_cost: 325 },
  { sku: 'CND10', name: 'CJC-1295 Without DAC', unit_size: 10, unit_measure: 'mg', base_cost: 135 },
  { sku: 'IP10', name: 'Ipamorelin', unit_size: 10, unit_measure: 'mg', base_cost: 59 },
  { sku: '10AD', name: 'AOD9604', unit_size: 10, unit_measure: 'mg', base_cost: 153 },
  { sku: 'MS10', name: 'MOTS-C', unit_size: 10, unit_measure: 'mg', base_cost: 59 },
  { sku: 'P41', name: 'PT-141', unit_size: 10, unit_measure: 'mg', base_cost: 58 },
  { sku: 'CU', name: 'GHK-CU', unit_size: 50, unit_measure: 'mg', base_cost: 28 },
  { sku: 'TA10', name: 'Thymosin Alpha-1', unit_size: 10, unit_measure: 'mg', base_cost: 142 },
  { sku: 'ET10', name: 'Epithalon', unit_size: 10, unit_measure: 'mg', base_cost: 34 },
  { sku: 'DS10', name: 'DSIP', unit_size: 10, unit_measure: 'mg', base_cost: 73 },
  { sku: 'KS10', name: 'KissPeptin-10', unit_size: 10, unit_measure: 'mg', base_cost: 91 },
  { sku: 'SK10', name: 'Selank', unit_size: 10, unit_measure: 'mg', base_cost: 68 },
  { sku: 'XA10', name: 'Semax', unit_size: 10, unit_measure: 'mg', base_cost: 68 },
  { sku: 'CP10', name: 'GH Synergy Stack (CJC 5mg + IPA 5mg)', unit_size: 10, unit_measure: 'mg', base_cost: 100 },
  { sku: 'NP810', name: 'SNAP-8', unit_size: 10, unit_measure: 'mg', base_cost: 37 },
  { sku: 'MT1', name: 'MT-1', unit_size: 10, unit_measure: 'mg', base_cost: 46 },
  { sku: 'K80', name: 'KLOW STACK (TB10+BPC10+GHK50+KPV10)', unit_size: 80, unit_measure: 'mg', base_cost: 200 },
  { sku: 'BBG70', name: 'Glow Stack (TB10 + BPC10 + GHK50)', unit_size: 70, unit_measure: 'mg', base_cost: 180 },
  // New ones added
  { sku: 'NJ1000', name: 'NAD+', unit_size: 1000, unit_measure: 'mg', base_cost: 132 },
  { sku: 'VP10', name: 'VIP', unit_size: 10, unit_measure: 'mg', base_cost: 155 },
  { sku: 'CGL10', name: 'Cagrilintide', unit_size: 10, unit_measure: 'mg', base_cost: 195 },
  { sku: 'LC600', name: 'L-carnitine', unit_size: 600, unit_measure: 'mg', base_cost: 37 },
  { sku: 'FR5', name: 'HGH Fragment 176-191', unit_size: 5, unit_measure: 'mg', base_cost: 85 },
  { sku: '375', name: 'LL-37', unit_size: 5, unit_measure: 'mg', base_cost: 84 },
  { sku: 'KP10', name: 'KPV', unit_size: 10, unit_measure: 'mg', base_cost: 61 },
  { sku: 'OT10', name: 'Oxytocin', unit_size: 10, unit_measure: 'mg', base_cost: 79 },
  { sku: 'F410', name: 'FOXO4-DRI', unit_size: 10, unit_measure: 'mg', base_cost: 310 },
  { sku: '2S10', name: 'SS-31', unit_size: 10, unit_measure: 'mg', base_cost: 85 },
  { sku: 'SMO10', name: 'Sermorelin', unit_size: 10, unit_measure: 'mg', base_cost: 116 },
  { sku: 'BA10', name: 'BAC Water', unit_size: 10, unit_measure: 'ml', base_cost: 11 }
];

const targetSkus = products.map(p => p.sku).filter(s => s !== 'BA10');

let quantities = {};
targetSkus.forEach(sku => {
  if (sku === 'NJ1000') quantities[sku] = 20;
  else quantities[sku] = 10;
});

const bacWaterCost = 1.10;

function getCost() {
  let total = 0;
  let totalPeptides = 0;
  targetSkus.forEach(sku => {
    let p = products.find(x => x.sku === sku);
    total += quantities[sku] * (p.base_cost / 10);
    totalPeptides += quantities[sku];
  });
  let bacWaterQty = Math.ceil((totalPeptides / 3) / 10) * 10;
  return total + (bacWaterQty * bacWaterCost);
}

const priority = ['TR20', 'TR10', 'SM20', 'SM10', 'BC10', 'BT10', 'RT20', 'RT10', 'CU', 'IP10', 'K80', 'BBG70', 'NP810', 'MT1'];
let budget = 6000;

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
    for (let sku of targetSkus) {
      quantities[sku] += 10;
      if (getCost() > budget) {
        quantities[sku] -= 10;
      } else {
        added = true;
        break;
      }
    }
  }
  if (!added) break;
}

let totalPeptides = 0;
let totalPeptideCost = 0;
targetSkus.forEach(sku => {
  totalPeptides += quantities[sku];
  let p = products.find(x => x.sku === sku);
  totalPeptideCost += quantities[sku] * (p.base_cost / 10);
});

let bacWaterQty = Math.ceil((totalPeptides / 3) / 10) * 10;

let finalCost = totalPeptideCost + (bacWaterQty * bacWaterCost);

while (finalCost + (10 * bacWaterCost) <= budget) {
  bacWaterQty += 10;
  finalCost += (10 * bacWaterCost);
}

let markdown = "# New Purchase Order ($6,000 Budget)\n\n";
markdown += "Here is the updated purchase order including the new peptides and utilizing the increased $6,000 budget.\n\n";
markdown += "| SKU | Product Name | Size | Qty | Unit Cost | Ext Cost |\n|---|---|---|---|---|---|\n";

targetSkus.forEach(sku => {
  let p = products.find(x => x.sku === sku);
  let qty = quantities[sku];
  let unitCost = p.base_cost / 10;
  let extCost = unitCost * qty;
  markdown += `| **${p.sku}** | ${p.name} | ${p.unit_size}${p.unit_measure || ''} | ${qty} | $${unitCost.toFixed(2)} | $${extCost.toFixed(2)} |\n`;
});

markdown += `| **BA10** | BAC Water | 10ml | ${bacWaterQty} | $${bacWaterCost.toFixed(2)} | $${(bacWaterQty * bacWaterCost).toFixed(2)} |\n`;

markdown += `\n### Order Totals\n`;
markdown += `- **Total Peptide Vials**: ${totalPeptides}\n`;
markdown += `- **Total BAC Water Vials**: ${bacWaterQty}\n`;
markdown += `- **Subtotal (Base Cost)**: **$${finalCost.toFixed(2)}**\n`;

fs.writeFileSync('scratch/calc_po_6k.md', markdown);
console.log("Done");
