require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkOrders() {
  const { data: o } = await supabase.from('orders').select('id, payment_method, is_paid, status, total');
  let issues = 0;
  for (const row of o || []) {
    if (row.payment_method === 'prepaid' && row.is_paid === false && row.status !== 'cancelled') {
      console.log(`Order ${row.id} is prepaid but not paid! Status: ${row.status}`);
      issues++;
    }
    if (row.payment_method === 'credit' && row.is_paid === true && row.status === 'pending') {
      // credit orders are paid later via statements, unless they pay immediately?
      // actually, credit orders are marked is_paid = true when a statement is paid.
    }
    if (row.total < 0) {
      console.log(`Order ${row.id} has negative total!`);
      issues++;
    }
  }
  console.log(`Order audit complete. Found ${issues} issues.`);
}
checkOrders();
