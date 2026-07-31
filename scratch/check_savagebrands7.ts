import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data: ap, error: apErr } = await supabase.from('agent_profiles').select('*').eq('slug', 'savagebrands').single();
  if (apErr) console.log('apErr', apErr);
  console.log('Agent profile:', ap);
  if (ap) {
    const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', ap.id).single();
    if (pErr) console.log('pErr', pErr);
    console.log('Profile:', p);
  }
}
check();
