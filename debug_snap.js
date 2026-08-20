require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: products } = await supabase.from('agent_products').select('id, retail_price, margin_percent, products!inner(base_cost, min_retail_price, max_retail_price, house_cost)').limit(10);
  
  for (const p of products) {
    if (!p.retail_price || String(p.retail_price).endsWith('.97')) continue;
    
    const snappedRetail = Math.round(Number(p.retail_price)) - 0.03;
    const ratio = snappedRetail / Number(p.retail_price);
    const newMarginRaw = (((1 + Number(p.margin_percent) / 100) * ratio) - 1) * 100;
    const newMargin = Math.round(newMarginRaw * 100) / 100;
    
    const maxAllowed = Number(p.products.max_retail_price);
    
    console.log(`Original: ${p.retail_price}, Snapped: ${snappedRetail}, maxAllowed: ${maxAllowed}, newMargin: ${newMargin}`);
    if (maxAllowed && snappedRetail > maxAllowed) console.log(' -> SKIPPED (exceeds max)');
    if (newMargin < 0) console.log(' -> SKIPPED (margin < 0)');
  }
}
run();
