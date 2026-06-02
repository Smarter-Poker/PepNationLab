require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { error } = await supabase
    .from('agent_profiles')
    .insert({
      id: '2ea68cc2-6764-4858-8721-3e928953e9ec',
      slug: 'tjp',
      display_name: 'Tim Partin',
      is_active: true
    });
  
  if (error) console.error("Error creating agent_profile:", error.message);
  else console.log("Created agent_profile for tjp!");
}

run();
