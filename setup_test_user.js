const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI';
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
