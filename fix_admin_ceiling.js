require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: adminProducts, error } = await supabase
    .from('agent_products')
    .select('id, retail_price, products!inner(base_cost)')
    .eq('agent_id', 'b8bd12e6-8196-401e-b37b-f742caf1596c');
    
  if (error) { console.error(error); return; }
  
  for (const ap of adminProducts) {
    const baseCost = Number(ap.products.base_cost);
    // Give a generous 400% markup for the admin store to lift the ceiling globally
    let newRetail = Math.round(baseCost * 4) - 0.03;
    
    // Make sure it doesn't drop below current, to avoid crushing other agents again
    if (newRetail < Number(ap.retail_price)) {
        newRetail = Math.ceil(Number(ap.retail_price)) - 0.03;
    }
    
    // We only need to update retail_price. The trigger will recalculate margin_percent
    // actually, wait, let's just supply margin_percent to be safe.
    const newMargin = Math.round(((newRetail / baseCost) - 1) * 100 * 100) / 100;
    
    await supabase.from('agent_products').update({ retail_price: newRetail, margin_percent: newMargin }).eq('id', ap.id);
  }
  
  console.log('Fixed admin ceiling.');
}
run();
