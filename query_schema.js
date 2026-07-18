require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('get_tables'); // this might not exist
  if (error) {
     // fallback to querying information_schema
     const { data: tables } = await supabase.from('products').select('name').limit(1);
     console.log("DB connection works. Let's list files to see if there are sql files for schema");
  }
}

run();
