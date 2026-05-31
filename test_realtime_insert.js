const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

async function run() {
  const svcUser = createClient(supabaseUrl, supabaseKey);
  const { data: { session }, error } = await svcUser.auth.signInWithPassword({ email: 'savagebrands@pepnationlab.com', password: 'TestPassword123!' });
  if (error) { console.error('Login err', error); return; }

  const convId = '5a28149d-b225-4339-9bc2-99ca19484d94';
  
  const ch = svcUser.channel(`conversation:${convId}`);
  ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messenger_messages', filter: `conversation_id=eq.${convId}` }, (payload) => {
    console.log('RECEIVED INSERT', payload);
    process.exit(0);
  });

  ch.subscribe(async (s) => {
    console.log('Subscribed:', s);
    if (s === 'SUBSCRIBED') {
      const svcAdmin = createClient(supabaseUrl, supabaseServiceKey);
      await new Promise(r => setTimeout(r, 1000));
      console.log('Inserting message as admin');
      await svcAdmin.from('messenger_messages').insert({
        conversation_id: convId,
        sender_id: session.user.id,
        content: 'test realtime insert ' + Date.now(),
        is_read: false
      });
      setTimeout(() => {
        console.log('Timeout waiting for insert broadcast');
        process.exit(1);
      }, 5000);
    }
  });
}
run();
