const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

async function run() {
  const svcUser = createClient(supabaseUrl, supabaseKey);
  const svcUser2 = createClient(supabaseUrl, supabaseKey);
  
  const { data: { session }, error } = await svcUser.auth.signInWithPassword({ email: 'anna@pepnationlab.com', password: 'TestPassword123!' });
  if (error) { console.error('Login 1 err', error); return; }

  const convId = '5a28149d-b225-4339-9bc2-99ca19484d94';
  const u1 = session.user.id;
  
  const ch1 = svcUser.channel(`typing:${convId}`, { config: { broadcast: { ack: false, self: false } } });
  const ch2 = svcUser2.channel(`typing:${convId}`, { config: { broadcast: { ack: false, self: false } } });

  ch2.on('broadcast', { event: 'typing' }, (payload) => {
    console.log('User 2 received typing:', payload);
    process.exit(0);
  });

  ch2.subscribe((s) => {
    if (s === 'SUBSCRIBED') {
      ch1.subscribe((s1) => {
        if (s1 === 'SUBSCRIBED') {
          console.log('Sending broadcast from user 1');
          ch1.send({ type: 'broadcast', event: 'typing', payload: { userId: u1, isTyping: true, at: Date.now() } });
        }
      });
    }
  });
}
run();
