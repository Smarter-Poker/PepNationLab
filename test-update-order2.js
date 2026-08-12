const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status')
    .eq('status', 'agent_approval_pending')
    .limit(1)
    .single();

  if (error || !data) {
    console.log("No pending order found:", error);
    return;
  }
  console.log("Order found:", data);

  const { data: upd, error: updErr } = await supabase
    .from('orders')
    .update({ status: 'approved_ship', updated_at: new Date().toISOString(), agent_approved_at: new Date().toISOString() })
    .eq('id', data.id)
    .select('id');
    
  console.log("Update result:", updErr ? updErr : upd);
}
run();
