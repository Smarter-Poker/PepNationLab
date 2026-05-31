const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzkzOTIsImV4cCI6MjA5NDk1NTM5Mn0.19bS915TJORh2frCU21Xn92lfa5XF2C26vKGZwjIiDk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const res = await fetch(supabaseUrl + '/rest/v1/profiles?username=eq.savagebrands', {
    headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey }
  });
  const data = await res.json();
  console.log('Savage Profile:', data);
}
run();
