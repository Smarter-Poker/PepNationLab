import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data, error } = await supabase.from('agent_profiles').select('id, slug, is_active');
  if (error) {
    console.error('Error fetching agent profiles:', error);
  } else {
    for (const a of data) {
       console.log(a.slug, a.is_active);
    }
  }
}
check();
