const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
const supabase = createClient(url, key);

async function run() {
  const { data: anna } = await supabase.from('profiles').select('id, email').eq('username', 'anna').single();
  const { data: danny } = await supabase.from('profiles').select('id, email').eq('username', 'danny').single();
  
  if (!anna || !danny) return console.log('Users not found');

  // Check if they have a conversation
  const { data: convs } = await supabase.from('messenger_participants').select('conversation_id').eq('user_id', anna.id);
  const myConvs = convs.map(c => c.conversation_id);
  
  const { data: shared } = await supabase.from('messenger_participants')
    .select('conversation_id')
    .in('conversation_id', myConvs)
    .eq('user_id', danny.id)
    .limit(1);

  let convId;
  if (shared && shared.length > 0) {
    convId = shared[0].conversation_id;
  } else {
    // create one
    const { data: conv } = await supabase.from('messenger_conversations')
      .insert([{ type: 'direct', created_by: danny.id }]).select().single();
    convId = conv.id;
    await supabase.from('messenger_participants').insert([
      { conversation_id: conv.id, user_id: danny.id, role: 'admin' },
      { conversation_id: conv.id, user_id: anna.id, role: 'member' }
    ]);
  }

  // 3. Send a message
  await supabase.from('messenger_messages').insert([
    { conversation_id: convId, sender_id: danny.id, body: 'Hello Anna! This is a test message from the agent. Are you seeing this in real-time?' }
  ]);
  
  console.log('Message sent successfully!');
}
run().catch(console.error);
