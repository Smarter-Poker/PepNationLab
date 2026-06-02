require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .eq('entity_id', 'ab2327cb-f58c-4e78-8f9e-899a49259f71');
  
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

run();
