require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: products } = await supabase.from('products').select('sku, name, unit_size, unit_measure, base_cost').order('name', { ascending: true });
  
  let markdown = "# Master Product Catalog: Base Costs\n\n";
  markdown += "> [!NOTE]\n> The Base Cost displayed below is the **actual per-vial cost** (database wholesale price divided by 10).\n\n";
  markdown += "| SKU | Product Name | Size | Base Cost (Per Vial) |\n";
  markdown += "| :--- | :--- | :--- | :--- |\n";
  
  products.forEach(p => {
    let unitCost = p.base_cost / 10;
    markdown += `| **${p.sku || 'N/A'}** | ${p.name} | ${p.unit_size}${p.unit_measure || ''} | $${unitCost.toFixed(2)} |\n`;
  });
  
  const fs = require('fs');
  fs.writeFileSync('/Users/smarter.poker/.gemini/antigravity/brain/36b8d1d7-0e6d-4948-90a7-33f2114fbcf5/base_costs_list.md', markdown);
  console.log("Wrote base costs to base_costs_list.md");
}
run();
