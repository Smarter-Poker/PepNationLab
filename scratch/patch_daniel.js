const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function patch() {
  const { data, error } = await supabase
    .from('profiles')
    .update({ username: 'daniel' })
    .eq('email', 'daniel@bekavactrading.com');
    
  console.log("Patched Daniel username:", { error });
}
patch();
