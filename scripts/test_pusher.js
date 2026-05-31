const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n');
let url = '', key = '';
for (const line of env) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1];
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1];
}
const supabase = createClient(url, key);

async function run() {
  const ch = supabase.channel(`call-signal:4b150992-0b32-47dc-913a-a53ec41f4c71`); // Using savagebrands ID to test subscribe
  ch.on('broadcast', { event: 'incoming_call' }, (payload) => {
    console.log('Received broadcast!', payload);
  }).subscribe((status) => {
    console.log('Status:', status);
    if (status === 'SUBSCRIBED') {
      console.log('Sending broadcast...');
      ch.send({ type: 'broadcast', event: 'incoming_call', payload: { test: 123 } });
    }
  });
}
run();
