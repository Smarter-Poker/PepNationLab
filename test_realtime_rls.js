const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

async function run() {
  const svcUser = createClient(supabaseUrl, supabaseKey);
  const { data: { session }, error } = await svcUser.auth.signInWithPassword({ email: 'danny@pepnationlab.com', password: 'TestPassword123!' });
  if (error) { console.error('Login err', error); return; }

  const ch = svcUser.channel(`rls_channel`);
  ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'test_realtime_rls' }, (payload) => {
    console.log('RLS RECEIVED INSERT', payload);
    process.exit(0);
  });

  ch.subscribe(async (s) => {
    console.log('Subscribed rls:', s);
    if (s === 'SUBSCRIBED') {
      const svcAdmin = createClient(supabaseUrl, supabaseServiceKey);
      await new Promise(r => setTimeout(r, 1000));
      console.log('Inserting into test_realtime_rls for Danny');
      await svcAdmin.from('test_realtime_rls').insert({ user_id: session.user.id });
      setTimeout(() => {
        console.log('Timeout waiting for rls broadcast');
        process.exit(1);
      }, 5000);
    }
  });
}
run();
