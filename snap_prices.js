require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: products, error } = await supabase.from('agent_products').select('id, retail_price, margin_percent, products!inner(base_cost, min_retail_price, max_retail_price, house_cost)');
  if (error) { console.error(error); return; }

  let updated = 0;
  for (const p of products) {
    if (!p.retail_price) continue;
    
    // Snap to .97
    const snappedRetail = Math.round(Number(p.retail_price)) - 0.03;
    
    // We must also recalculate the margin_percent to match the snapped retail price.
    const ratio = snappedRetail / Number(p.retail_price);
    const newMarginRaw = (((1 + Number(p.margin_percent) / 100) * ratio) - 1) * 100;
    const newMargin = Math.round(newMarginRaw * 100) / 100;
    
    // Skip if it violates the DB max_retail_price
    const maxAllowed = Number(p.products.max_retail_price);
    if (maxAllowed && snappedRetail > maxAllowed) {
      continue;
    }
    
    // Ensure margin doesn't go below 0 if they have a constraint
    if (newMargin < 0) {
      continue;
    }
    
    const { error: upErr } = await supabase
      .from('agent_products')
      .update({ retail_price: snappedRetail, margin_percent: newMargin })
      .eq('id', p.id);
      
    if (upErr) {
      console.error('Failed to update', p.id, upErr.message);
    } else {
      updated++;
    }
  }
  
  console.log(`Successfully snapped retail prices to .97 on ${updated} agent products.`);
}
run();
