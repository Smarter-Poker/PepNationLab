const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
const supabase = createClient(url, key);

async function run() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  console.log('Auth users:', users.users.map(u => u.email));
  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log('Profiles:', profiles.map(p => ({ id: p.id, username: p.username, email: p.email })));
}
run().catch(console.error);
