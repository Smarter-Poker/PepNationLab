const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

async function run() {
  const svcAdmin = createClient(supabaseUrl, supabaseKey);
  const { data: prof, error } = await svcAdmin.from('profiles').select('is_active, id').eq('email', 'anna@pepnationlab.com').single();
  console.log('Profile:', prof, error);
}
run();
