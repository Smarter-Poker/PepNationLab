const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}
const supabase = createClient(url, key);

async function run() {
  const { data: conv } = await supabase.from('messenger_conversations').insert({
    type: 'direct'
  }).select().single();
  
  const userId = '3a9ca8ce-78db-411b-b27a-2104c9d59412';
  
  await supabase.from('messenger_participants').insert([
    { conversation_id: conv.id, user_id: userId },
    { conversation_id: conv.id, user_id: '1e5e6e8e-d983-4a11-8be5-6f6f1c4e7239' } // assuming this user exists, we can use the previous error user
  ]);
  
  console.log('Conv ID:', conv.id);
}
run().catch(console.error);
