require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runAudit() {
  const { data: p } = await supabase.from('profiles').select('id, account_type').in('role', ['agent', 'super_agent']);
  let issues = 0;
  for (const row of p || []) {
    if (row.account_type !== 'credit' && row.account_type !== 'prepaid' && row.account_type !== null) {
      console.log(`Agent ${row.id} has invalid account_type: ${row.account_type}`);
      issues++;
    }
  }
  console.log(`Audit complete. Found ${issues} invalid account types.`);
}
runAudit();
