const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI';
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
