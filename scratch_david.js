const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .ilike('full_name', '%David Dapper%');
  
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

main();
