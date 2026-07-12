require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runAudit() {
  const { data: p } = await supabase.from('profiles').select('id, account_type, credit_limit').eq('account_type', 'credit');
  let issues = 0;
  for (const row of p || []) {
    if (row.credit_limit === null || row.credit_limit === undefined) {
      console.log(`Credit agent ${row.id} has NO credit limit!`);
      issues++;
    }
  }
  console.log(`Audit complete. Found ${issues} issues with credit agents.`);
}
runAudit();
