require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  const { error } = await supabase
    .from('profiles')
    .update({ credit_limit: null, max_auto_approve_limit: null, auto_approve_orders: false })
    .or('account_type.eq.prepaid,account_type.is.null')
    .neq('credit_limit', null); // This won't work in supabase cleanly. Let's do it individually.

  const { data: p } = await supabase.from('profiles').select('id').or('account_type.eq.prepaid,account_type.is.null');
  for(const row of p || []) {
      await supabase.from('profiles').update({ credit_limit: null, max_auto_approve_limit: null, auto_approve_orders: false }).eq('id', row.id);
  }
  console.log("Fixed.");
}
fix();
