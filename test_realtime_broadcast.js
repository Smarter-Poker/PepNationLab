const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n');
let supabaseUrl = '';
let supabaseServiceKey = '';

for (const line of env) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1];
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseServiceKey = line.split('=')[1];
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  console.log('Sending test broadcast...');
  // Find a test user ID. Let's just use an arbitrary ID or a specific one if we know it.
}
test();
