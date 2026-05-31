const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

async function run() {
  const svcUser = createClient(supabaseUrl, supabaseKey);
  const { data: { session }, error } = await svcUser.auth.signInWithPassword({ email: 'savagebrands@pepnationlab.com', password: 'TestPassword123!' });
  if (error) { console.error('Login 1 err', error); return; }

  const u1 = session.user.id;
  const convId = '5a28149d-b225-4339-9bc2-99ca19484d94';
  
  const ch1 = svcUser.channel(`typing:${convId}`, { config: { broadcast: { ack: false, self: false } } });

  ch1.on('broadcast', { event: 'typing' }, (payload) => {
    console.log('Received broadcast', payload);
  });

  ch1.subscribe((s) => {
    if (s === 'SUBSCRIBED') {
      console.log('Sending broadcast from user 1');
      ch1.send({ type: 'broadcast', event: 'typing', payload: { userId: u1, isTyping: true, at: Date.now() } });
      setTimeout(() => process.exit(0), 10000);
    }
  });
}
run();
