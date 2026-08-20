require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: products } = await supabase.from('products').select('id, base_cost, name');
  const baseCostMap = new Map(products.map(p => [p.id, Number(p.base_cost) || 0]));
  const bacWaterIds = new Set(products.filter(p => /bac\.?\s*water/i.test(p.name)).map(p => p.id));

  const { data: agentProducts } = await supabase.from('agent_products').select('id, product_id, retail_price, sale_price');
  
  let fixedCount = 0;
  for (const ap of agentProducts) {
    if (!ap.retail_price) continue;
    if (bacWaterIds.has(ap.product_id)) continue;
    
    const baseCost = baseCostMap.get(ap.product_id) || 0;
    if (baseCost === 0) continue;
    
    const ratio = ap.retail_price / baseCost;
    if (ratio > 7) {
      const newRetail = Math.round((ap.retail_price / 10) * 100) / 100;
      const newSale = ap.sale_price ? Math.round((ap.sale_price / 10) * 100) / 100 : null;
      
      console.log(`Fixing ${ap.id}: retail ${ap.retail_price} -> ${newRetail} (base: ${baseCost})`);
      
      await supabase.from('agent_products').update({ retail_price: newRetail, sale_price: newSale }).eq('id', ap.id);
      fixedCount++;
    }
  }
  
  console.log(`Fixed ${fixedCount} agent products.`);
}

run();
