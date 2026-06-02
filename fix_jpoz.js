require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { error } = await supabase
    .from('profiles')
    .update({ phone: null })
    .ilike('email', '%jpoz%');
  
  if (error) console.error("Error updating jpoz:", error.message);
  else console.log("Removed phone data for jpoz");
}

run();
