const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status')
    .eq('status', 'admin_approval_pending')
    .limit(1)
    .single();

  if (error || !data) {
    console.log("No pending order found:", error);
    return;
  }

  const { data: upd, error: updErr } = await supabase
    .from('orders')
    .update({ status: 'approved_ship' })
    .eq('id', data.id)
    .select('id');
    
  console.log("Update error:", updErr);
}
run();
