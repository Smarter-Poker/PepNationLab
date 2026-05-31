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
  
  console.log('User id:', senderId);
  const { data, error: participantError } = await svcUser.from('messenger_participants').select('*').eq('conversation_id', convId).eq('user_id', senderId);
  console.log('Participant:', data, participantError);
}
run();
