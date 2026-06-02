require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('profiles')
    .select('username, email')
    .like('email', '%@pepnationlab.com');
  
  if (error) console.error("Error:", error.message);
  else console.log("Remaining fake emails:", data.length);
}

run();
