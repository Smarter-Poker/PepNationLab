require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkPromote() {
  const { data: p } = await supabase.from('profiles').select('id, auto_approve_orders, max_auto_approve_limit').limit(1);
  console.log(p);
}
checkPromote();
