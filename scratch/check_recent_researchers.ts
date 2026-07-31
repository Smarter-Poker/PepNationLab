import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const houseStore = 'b8bd12e6-8196-401e-b37b-f742caf1596c';
  
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, email, full_name, created_at, referring_agent_id')
    .eq('role', 'researcher')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    return;
  }
  
  console.log('Recent 10 researcher profiles:');
  for (const p of profiles) {
    console.log(`- [${p.created_at}] ${p.username} (${p.email}) - agent: ${p.referring_agent_id === houseStore ? 'HOUSE' : p.referring_agent_id}`);
  }
}
check();
