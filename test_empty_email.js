require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('profiles')
    .update({ email: '' })
    .eq('id', '2e0b72d4-0470-4849-a5c2-f8c48b6ef290');
  
  if (error) console.error("Error:", error.message);
  else console.log("Success setting email to empty string");
}

run();
