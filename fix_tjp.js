require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { error } = await supabase
    .from('profiles')
    .update({ is_sub_agent: false })
    .eq('id', '2ea68cc2-6764-4858-8721-3e928953e9ec');
  
  if (error) console.error("Error updating tjp:", error.message);
  else console.log("tjp successfully updated to Full Agent (is_sub_agent: false)");
}

run();
