import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await supabase
    .from('messenger_messages')
    .select('id, text, created_at, sender_id, conversation_id')
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }
  
  const duplicates = [];
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    if (prev.sender_id === curr.sender_id && prev.text === curr.text && prev.conversation_id === curr.conversation_id) {
      const t1 = new Date(prev.created_at).getTime();
      const t2 = new Date(curr.created_at).getTime();
      if (t2 - t1 < 60000) {
        duplicates.push({ prev, curr });
      }
    }
  }
  
  console.log(`Found ${duplicates.length} duplicates.`);
  if (duplicates.length > 0) {
    console.log(JSON.stringify(duplicates.slice(0, 5), null, 2));
  }
}

run();
