require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('agent_profiles')
    .select('*')
    .eq('id', '2ea68cc2-6764-4858-8721-3e928953e9ec');
  
  if (error) console.error(error.message);
  else console.log("agent_profiles:", data.length);
}

run();
