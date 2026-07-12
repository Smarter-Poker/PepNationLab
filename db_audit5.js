require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function finalAudit() {
  const { data: p } = await supabase.from('profiles').select('id, full_name, account_type, credit_limit, auto_approve_orders, max_auto_approve_limit').or('account_type.eq.prepaid,account_type.is.null');
  let issues = 0;
  for (const row of p || []) {
    if (row.credit_limit !== null) {
      console.log(`Prepaid agent ${row.id} has credit_limit ${row.credit_limit}`);
      issues++;
    }
    if (row.auto_approve_orders) {
      console.log(`Prepaid agent ${row.id} has auto_approve_orders=true`);
      issues++;
    }
    if (row.max_auto_approve_limit !== null) {
      console.log(`Prepaid agent ${row.id} has max_auto_approve_limit ${row.max_auto_approve_limit}`);
      issues++;
    }
  }
  console.log(`Final audit complete. Found ${issues} state sync anomalies.`);
}
finalAudit();
