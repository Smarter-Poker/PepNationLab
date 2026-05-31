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
  
  const { data, error: msgError } = await svcUser.from('messenger_messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: false }).limit(2);
  console.log('Messages:', data, msgError);
}
run();
