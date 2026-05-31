const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

async function run() {
  const svcAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  const ch = svcAdmin.channel(`dummy_channel`);
  ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'test_realtime_dummy' }, (payload) => {
    console.log('DUMMY RECEIVED INSERT', payload);
    process.exit(0);
  });

  ch.subscribe(async (s) => {
    console.log('Subscribed dummy:', s);
    if (s === 'SUBSCRIBED') {
      await new Promise(r => setTimeout(r, 1000));
      console.log('Inserting into dummy');
      await svcAdmin.from('test_realtime_dummy').insert({ text: 'hello' });
      setTimeout(() => {
        console.log('Timeout waiting for dummy broadcast');
        process.exit(1);
      }, 5000);
    }
  });
}
run();
