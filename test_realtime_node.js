require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Must trim keys just like the fix!
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

console.log('Connecting to:', url);
console.log('Key length:', key.length);

const supabase = createClient(url, key);

const channel = supabase.channel('test_channel');

channel.on('system', { event: '*' }, (payload) => {
  console.log('System Event:', payload);
});

channel.subscribe((status, err) => {
  console.log('Subscribe Status:', status);
  if (err) console.error('Subscribe Error:', err);
  
  if (status === 'SUBSCRIBED') {
    console.log('Successfully connected to Supabase Realtime!');
    process.exit(0);
  }
  if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
    console.log('Failed to connect to Supabase Realtime.');
    process.exit(1);
  }
});

// Timeout after 10s
setTimeout(() => {
  console.log('Timeout reached');
  process.exit(1);
}, 10000);
