const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', '9edf26d7-2f8d-4890-89f5-fcea4668e47d')
    .single();

  console.log("Order state:", data);

  if (!data) return;

  const { data: upd, error: updErr } = await supabase
    .from('orders')
    .update({ status: 'approved_ship' })
    .eq('id', data.id)
    .select('id');
    
  console.log("Update result:", updErr ? updErr.message : "Success");
}
run();
