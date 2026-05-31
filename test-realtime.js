const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  require('dotenv').config({ path: '.env.local' });
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const ch = supabase.channel('conversation:test');
ch.on('postgres_changes', { event: '*', schema: 'public', table: 'messenger_messages' }, () => {});
ch.subscribe((status, err) => {
  console.log('Status:', status, err);
  process.exit(0);
});
