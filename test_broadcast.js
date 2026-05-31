const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

// Use a mock JWT or service key just to test broadcast
const svc1 = createClient(supabaseUrl, supabaseKey);
const svc2 = createClient(supabaseUrl, supabaseKey);

async function run() {
  const convId = 'test-conversation-123';
  
  const ch1 = svc1.channel(`typing:${convId}`, { config: { broadcast: { ack: false, self: false } } });
  const ch2 = svc2.channel(`typing:${convId}`, { config: { broadcast: { ack: false, self: false } } });

  ch2.on('broadcast', { event: 'typing' }, (payload) => {
    console.log('Received broadcast on ch2:', payload);
    process.exit(0);
  });

  ch2.subscribe((status) => {
    console.log('ch2 status:', status);
    if (status === 'SUBSCRIBED') {
      ch1.subscribe((status1) => {
        console.log('ch1 status:', status1);
        if (status1 === 'SUBSCRIBED') {
          console.log('Sending broadcast from ch1');
          ch1.send({ type: 'broadcast', event: 'typing', payload: { isTyping: true } });
        }
      });
    }
  });
}
run();
