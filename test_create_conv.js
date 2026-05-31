const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
const supabase = createClient(url, key);

async function run() {
  const { data: user1, error: e1 } = await supabase.from('profiles').select('id, email').eq('email', 'test_ws_debug@example.com').single();
  const { data: user2, error: e2 } = await supabase.from('profiles').select('id, email').eq('email', 'anna@pepnationlab.com').single();
  
  if (!user1 || !user2) return console.log('Users not found', e1, e2);

  // 1. Create conversation
  const { data: conv, error: cErr } = await supabase.from('messenger_conversations')
    .insert([{ type: 'direct', created_by: user1.id }]).select().single();
  if (cErr) return console.error('Conv error', cErr);

  // 2. Add participants
  await supabase.from('messenger_participants').insert([
    { conversation_id: conv.id, user_id: user1.id, role: 'admin' },
    { conversation_id: conv.id, user_id: user2.id, role: 'member' }
  ]);

  // 3. Send a message
  await supabase.from('messenger_messages').insert([
    { conversation_id: conv.id, sender_id: user2.id, body: 'Hello! I am Anna. Please reply to me to test the websocket bubbles.' }
  ]);
  
  console.log('Conversation created successfully!');
}
run().catch(console.error);
