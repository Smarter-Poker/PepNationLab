const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

async function run() {
  const svcAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const convId = '5a28149d-b225-4339-9bc2-99ca19484d94';
  
  const ch = svcAdmin.channel(`my_admin_channel`);
  ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messenger_messages' }, (payload) => {
    console.log('ADMIN RECEIVED INSERT', payload);
    process.exit(0);
  });

  ch.subscribe(async (s) => {
    console.log('Subscribed admin:', s);
    if (s === 'SUBSCRIBED') {
      await new Promise(r => setTimeout(r, 1000));
      console.log('Inserting message as admin');
      await svcAdmin.from('messenger_messages').insert({
        conversation_id: convId,
        sender_id: '2db791ef-00fe-43b5-af40-e8c07c93fe1f',
        content: 'test admin realtime ' + Date.now(),
        is_read: false
      });
      setTimeout(() => {
        console.log('Timeout waiting for admin broadcast');
        process.exit(1);
      }, 5000);
    }
  });
}
run();
