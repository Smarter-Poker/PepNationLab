require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, email, role, is_sub_agent, parent_agent_id')
    .ilike('full_name', '%Tim Partin%');
  
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

run();
