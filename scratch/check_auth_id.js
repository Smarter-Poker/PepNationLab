const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const u = users.find(x => x.email === 'daniel@bekavactrading.com');
  console.log("Auth User ID:", u?.id);
  
  const { data } = await supabase.from('profiles').select('id').eq('email', 'daniel@bekavactrading.com').single();
  console.log("Profile User ID:", data?.id);
}
check();
