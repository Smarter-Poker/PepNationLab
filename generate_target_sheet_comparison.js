require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const overrides = {
  'BT5': 3.80,
  'BT10': 6.60,
  '5AD': 4.00,
  '10AD': 6.00,
  'FR5': 4.00,
  'CND5': 4.00,
  'CND10': 7.00,
  'CD5': 6.00,
  'IG1': 9.00,
  'F410': 16.00,
  'TA5': 5.00,
  'TA10': 8.50,
  'CGL5': 7.00,
  'CGL10': 12.00,
  'SUR10': 18.00,
  'TSM5': 7.00,
  'TSM10': 12.00,
  'TSM20': 22.00,
  'SMO5': 4.00,
  'SMO10': 6.00,
  'HX5': 4.50,
  'VP10': 10.00,
  '2S50': 25.00,
  'BB10': 7.60,
  'BB20': 13.20,
  'CP10': 8.50,
  'CS10': 12.00
};

async function run() {
  const { data: products } = await supabase.from('products').select('sku, name, unit_size, unit_measure, base_cost').order('name', { ascending: true });
  
  let markdown = "# Master Product Catalog: Target vs. Current Pricing\n\n";
  markdown += "Please review our updated target wholesale pricing for the upcoming quarter based on volume distribution. Prices that align with market rates have been confirmed, while specific SKUs have been adjusted to match fair market component valuations.\n\n";
  
  markdown += "| SKU | Product Name | Size | Current Cost | Target Cost | Difference |\n";
  markdown += "| :--- | :--- | :--- | :--- | :--- | :--- |\n";
  
  products.forEach(p => {
    let currentCost = p.base_cost / 10;
    let targetCost = overrides[p.sku] !== undefined ? overrides[p.sku] : currentCost;
    
    // Shred stack is weird (no sku?), I'll hardcode if name matches
    if (p.name.includes('Shred Stack') && overrides[p.sku] === undefined) {
      targetCost = 10.00;
    }
    
    let diff = targetCost - currentCost;
    let diffStr = diff === 0 ? "-" : (diff > 0 ? `+$${diff.toFixed(2)}` : `-$${Math.abs(diff).toFixed(2)}`);
    
    markdown += `| **${p.sku || 'N/A'}** | ${p.name} | ${p.unit_size}${p.unit_measure || ''} | $${currentCost.toFixed(2)} | **$${targetCost.toFixed(2)}** | ${diffStr} |\n`;
  });
  
  const fs = require('fs');
  fs.writeFileSync('/Users/smarter.poker/.gemini/antigravity/brain/36b8d1d7-0e6d-4948-90a7-33f2114fbcf5/target_pricing_sheet.md', markdown);
  console.log("Wrote to target_pricing_sheet.md with comparison");
}
run();
