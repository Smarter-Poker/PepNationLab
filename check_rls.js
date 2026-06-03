require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRLS() {
  const { data, error } = await supabase.rpc('temp_run_sql', {
    query: "SELECT json_agg(tablename) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;"
  });
  if (error) {
    console.error(error);
  } else {
    console.log("Tables missing RLS:");
    console.log(data);
  }
}
checkRLS();
