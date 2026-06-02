require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('parent_agent_id', 'ab2327cb-f58c-4e78-8f9e-899a49259f71')
    .eq('is_sub_agent', true);
  
  if (error) console.error(error.message);
  else console.log("Other sub-agents:", data.map(d => d.username));
}

run();
