import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data: aps } = await supabase.from('agent_profiles').select('*');
  for (const ap of (aps || [])) {
     if (ap.slug.includes('savage') || ap.name?.toLowerCase().includes('savage')) {
        console.log('Agent profile:', ap);
        const { data: p } = await supabase.from('profiles').select('*').eq('id', ap.id).single();
        console.log('Profile:', p);
     }
  }
}
check();
