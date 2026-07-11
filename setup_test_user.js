const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}
const supabase = createClient(url, key);

async function run() {
  const email = 'test_ws_debug@example.com';
  const password = 'Password123!';
  
  const { data: adminData } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  console.log('User:', adminData.user.id);
  
  await supabase.from('profiles').insert({
    id: adminData.user.id,
    email,
    username: 'test_ws_debug',
    full_name: 'Test WS Debug',
    role: 'researcher'
  });
}
run().catch(console.error);
