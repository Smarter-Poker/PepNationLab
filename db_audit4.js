require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkNeg() {
  const { data: p } = await supabase.from('profiles').select('id, full_name, prepaid_balance').lt('prepaid_balance', 0);
  console.log("Negative balances:", p);
}
checkNeg();
