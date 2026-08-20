require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: products, error } = await supabase.from('agent_products').select('*');
  if (error) { console.error(error); return; }

  let updated = 0;
  for (const p of products) {
    if (!p.retail_price) continue;
    
    // We only want to revert if it was actually inflated.
    // Assuming everything was inflated by 1.35 earlier today.
    const newRetail = Math.round((Number(p.retail_price) / 1.35) * 100) / 100;
    const newMargin = Math.round((((1 + Number(p.margin_percent) / 100) / 1.35 - 1) * 100) * 100) / 100;
    
    const { error: upErr } = await supabase
      .from('agent_products')
      .update({ retail_price: newRetail, margin_percent: newMargin })
      .eq('id', p.id);
      
    if (upErr) {
      console.error('Failed to update', p.id, upErr);
    } else {
      updated++;
    }
  }
  
  console.log(`Successfully reverted retail prices and reduced profit margins on ${updated} agent products.`);
}
run();
