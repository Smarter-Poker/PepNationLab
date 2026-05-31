const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

async function run() {
  const svcAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  const ch = svcAdmin.channel(`listen_channel`);
  ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messenger_messages' }, (payload) => {
    console.log('LISTEN RECEIVED INSERT', payload);
  });

  ch.subscribe(async (s) => {
    console.log('Subscribed listen:', s);
  });
}
run();
