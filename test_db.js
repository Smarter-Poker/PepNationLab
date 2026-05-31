const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzkzOTIsImV4cCI6MjA5NDk1NTM5Mn0.19bS915TJORh2frCU21Xn92lfa5XF2C26vKGZwjIiDk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data } = await supabase.from('profiles').select('id, full_name, role, username').ilike('full_name', '%Daniel%');
  console.log('Daniel Profiles:', data);
  const { data: d2 } = await supabase.from('profiles').select('id, full_name, role, username').ilike('username', '%savage%');
  console.log('Savage Profiles:', d2);
}
run();
