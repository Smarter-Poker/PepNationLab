import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data: profiles } = await supabase.from('profiles').select('id, username').ilike('username', '%savage%');
  console.log('Profiles with savage:', profiles);

  for (const p of (profiles || [])) {
     const { data: ap } = await supabase.from('agent_profiles').select('*').eq('id', p.id);
     console.log('Agent profile for', p.username, ':', ap);
  }
}
check();
