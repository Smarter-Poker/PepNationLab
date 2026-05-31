const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

async function run() {
  const svcAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  const ch = svcAdmin.channel(`profiles_test`);
  ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
    console.log('RECEIVED PROFILES UPDATE', payload);
    process.exit(0);
  });

  ch.subscribe(async (s) => {
    console.log('Subscribed:', s);
    if (s === 'SUBSCRIBED') {
      await new Promise(r => setTimeout(r, 1000));
      console.log('Updating profile');
      const { data } = await svcAdmin.from('profiles').select('id, full_name').limit(1);
      if (data && data.length > 0) {
        await svcAdmin.from('profiles').update({ full_name: data[0].full_name + ' ' }).eq('id', data[0].id);
      }
      setTimeout(() => {
        console.log('Timeout waiting for profiles update');
        process.exit(1);
      }, 5000);
    }
  });
}
run();
