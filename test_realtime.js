const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

async function run() {
  const svc = createClient(supabaseUrl, supabaseServiceKey);
  
  // Find a conversation
  const { data: conv } = await svc.from('messenger_conversations').select('id').limit(1).single();
  if (!conv) { console.log('no conversation'); return; }
  const convId = conv.id;
  console.log('Subscribing to conv', convId);

  const ch = svc.channel(`conversation:${convId}`);
  ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messenger_messages', filter: `conversation_id=eq.${convId}` }, (payload) => {
    console.log('REALTIME INSERT', payload);
  });
  
  ch.subscribe(async (status) => {
    console.log('Status:', status);
    if (status === 'SUBSCRIBED') {
      console.log('Inserting message...');
      await svc.from('messenger_messages').insert({
        conversation_id: convId,
        sender_id: '844dca4b-6f01-4779-bc95-bfa1e0809c0c',
        message_type: 'text',
        text: 'Hello from test',
        client_message_id: 'test-123'
      });
      setTimeout(() => {
        console.log('Done wait');
        process.exit(0);
      }, 5000);
    }
  });
}
run();
