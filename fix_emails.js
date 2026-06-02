require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Fixing @internal.auth...");
  const { data: d1, error: e1 } = await supabase
    .from('profiles')
    .update({ email: null })
    .ilike('email', '%@internal.auth%')
    .select('id, username');
  
  if (e1) console.error("Error 1:", e1);
  else console.log("Fixed internal.auth:", d1?.length);

  console.log("Fixing @pepnationlab.com...");
  const { data: d2, error: e2 } = await supabase
    .from('profiles')
    .update({ email: null })
    .ilike('email', '%@pepnationlab.com%')
    .not('email', 'in', '("daniel@pepnationlab.com","admin@pepnationlab.com","support@pepnationlab.com","research@pepnationlab.com")')
    .select('id, username');
    
  if (e2) console.error("Error 2:", e2);
  else console.log("Fixed pepnationlab.com:", d2?.length);
}

run();
