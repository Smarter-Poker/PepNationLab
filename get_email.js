const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await sb.auth.admin.listUsers();
  const user = data.users.find(u => JSON.stringify(u.user_metadata || {}).toLowerCase().includes('savage'));
  console.log(user?.email || 'Not found');
}
run();
