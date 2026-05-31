const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

async function run() {
  const svcUser = createClient(supabaseUrl, supabaseKey);
  
  const { data: { session }, error } = await svcUser.auth.signInWithPassword({
    email: 'anna@pepnationlab.com',
    password: 'TestPassword123!'
  });
  if (error) { console.error('Login error', error); return; }
  
  const convId = '5a28149d-b225-4339-9bc2-99ca19484d94';
  const senderId = session.user.id;
  
  const ch = svcUser.channel(`conversation:${convId}`);
  ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messenger_messages', filter: `conversation_id=eq.${convId}` }, (payload) => {
    console.log('REALTIME MSG INSERT (ANON):', payload);
  });

  ch.subscribe(async (status) => {
    console.log('Subscribe status:', status);
    if (status === 'SUBSCRIBED') {
      const res = await svcUser.from('messenger_messages').insert({
        conversation_id: convId,
        sender_id: senderId,
        message_type: 'text',
        text: 'Realtime test user anon',
        client_message_id: '587615ce-0c25-4cf4-8b78-5ce21bd4097e'
      });
      console.log('User inserted message');
      setTimeout(() => process.exit(0), 5000);
    }
  });
}
run();
