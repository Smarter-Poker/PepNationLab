const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function run() {
  console.log('Deleting BPC-157 Research Grade and Epithalon Test products...');
  
  // 1. Find them
  const { data: prods, error: e1 } = await supabase.from('products').select('id, name')
    .or("name.ilike.%BPC-157 Research Grade%,name.ilike.%Epithalon%Test%,name.ilike.%Test Print%");
    
  if (e1) { console.error(e1); return; }
  console.log('Found:', prods.map(p => p.name));
  
  const ids = prods.map(p => p.id);
  if (ids.length === 0) { console.log('None found.'); return; }
  
  // 2. Delete from agent_products (if any)
  await supabase.from('agent_products').delete().in('product_id', ids);
  
  // 3. Delete from product_tags (if any)
  await supabase.from('product_tags').delete().in('product_id', ids);
  
  // 4. Delete the products
  const { error: e4 } = await supabase.from('products').delete().in('id', ids);
  if (e4) { console.error('Error deleting products:', e4); }
  else { console.log('Successfully deleted the products.'); }
}
run();
