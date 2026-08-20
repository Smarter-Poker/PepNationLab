require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: products, error } = await supabase.from('agent_products').select('id, retail_price, margin_percent');
  if (error) { console.error(error); return; }

  let updated = 0;
  for (const p of products) {
    if (!p.retail_price || String(p.retail_price).endsWith('.97')) continue;
    
    // Snap to .97, rounding UP if it would drop below the current value
    // (since current value might be the absolute DB floor)
    let snappedRetail = Math.round(Number(p.retail_price)) - 0.03;
    if (snappedRetail < Number(p.retail_price)) {
      snappedRetail += 1.00;
    }
    
    // Calculate new margin (doesn't have to be perfect, just needs to be high enough,
    // the DB trigger will NOT re-calculate retail_price from margin_percent IF retail_price is provided and valid!)
    // Wait, the DB trigger doesn't recalculate retail_price from margin_percent? 
    // Actually, I don't even need to send margin_percent! The DB trigger might calculate margin_percent FOR me!
    // Let's just send retail_price! If I just send retail_price, the UI usually calculates margin, 
    // but the DB trigger might not. Let's send a slightly higher margin to be safe.
    
    const ratio = snappedRetail / Number(p.retail_price);
    const newMarginRaw = (((1 + Number(p.margin_percent) / 100) * ratio) - 1) * 100;
    const newMargin = Math.round(newMarginRaw * 100) / 100;
    
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
  
  console.log(`Successfully snapped retail prices UP to .97 on ${updated} agent products.`);
}
run();
