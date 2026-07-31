import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data: aps } = await supabase.from('agent_profiles').select('id, slug, name, is_active');
  console.log('All agent profiles slugs:', aps?.map(a => a.slug));
}
check();
