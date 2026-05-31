const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

async function run() {
  const svcAnna = createClient(supabaseUrl, supabaseKey);
  const svcDanny = createClient(supabaseUrl, supabaseKey);
  
  const { data: { session: s1 }, error: e1 } = await svcAnna.auth.signInWithPassword({ email: 'anna@pepnationlab.com', password: 'TestPassword123!' });
  const { data: { session: s2 }, error: e2 } = await svcDanny.auth.signInWithPassword({ email: 'savagebrands@pepnationlab.com', password: 'TestPassword123!' });
  
  if (e1 || e2) { console.error('Login err', e1, e2); return; }

  const convId = '5a28149d-b225-4339-9bc2-99ca19484d94';
  const uAnna = s1.user.id;
  const uDanny = s2.user.id;
  
  const chAnna = svcAnna.channel(`typing:${convId}`, { config: { broadcast: { ack: false, self: false } } });
  const chDanny = svcDanny.channel(`typing:${convId}`, { config: { broadcast: { ack: false, self: false } } });

  chDanny.on('broadcast', { event: 'typing' }, (payload) => {
    console.log('Danny received typing broadcast:', payload);
    process.exit(0);
  });

  chDanny.subscribe((s) => {
    if (s === 'SUBSCRIBED') {
      chAnna.subscribe((s1) => {
        if (s1 === 'SUBSCRIBED') {
          console.log('Sending broadcast from Anna');
          chAnna.send({ type: 'broadcast', event: 'typing', payload: { userId: uAnna, isTyping: true, at: Date.now() } });
        }
      });
    }
  });
}
run();
