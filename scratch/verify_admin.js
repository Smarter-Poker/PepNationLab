const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAdmin() {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'daniel@bekavactrading.com')
    .single();
    
  console.log("Admin profile via Service Role:", profile);
}

testAdmin();
