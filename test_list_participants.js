const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

async function run() {
  const svcUser = createClient(supabaseUrl, supabaseKey);
  const { data: { session }, error } = await svcUser.auth.signInWithPassword({ email: 'anna@pepnationlab.com', password: 'TestPassword123!' });
  
  if (error) { console.error(error); return; }
  
  const token = session.access_token;
  const refresh = session.refresh_token;
  const authCookie = encodeURIComponent(JSON.stringify([token, refresh, null, null, null]));

  const res = await fetch('http://localhost:3000/api/messenger/list-participants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': `sb-ydsaqnnuwyvtyxgvrnys-auth-token=${authCookie}` },
    body: JSON.stringify({ conversationId: '5a28149d-b225-4339-9bc2-99ca19484d94' })
  });
  console.log(res.status, await res.text());
}
run();
