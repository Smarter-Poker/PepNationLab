require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function test() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: tirz } = await supabase.from('products').select('id, name, unit_size').ilike('name', '%tirzepatide%').limit(1).single();
  const { data: bpc } = await supabase.from('products').select('id, name, unit_size').ilike('name', '%BPC-157%').limit(1).single();
  
  console.log("Testing with:", tirz, bpc);
  
  const payload = {
    productIds: [tirz.id, bpc.id],
    quantities: { [tirz.id]: 2, [bpc.id]: 1 } // 2x Tirzepatide, 1x BPC-157
  };
  
  const res = await fetch('https://pepnationlab.com/api/cart/bac-water', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Origin': 'https://pepnationlab.com',
      'Referer': 'https://pepnationlab.com/checkout'
    },
    body: JSON.stringify(payload)
  });
  
  const json = await res.json();
  console.log("API Response:", json);
}
test();
