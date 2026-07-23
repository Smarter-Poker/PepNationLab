import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SAVAGE_ID = '844dca4b-6f01-4779-bc95-bfa1e0809c0c';

async function main() {
  // How many researchers reference savagebrands as their referring_agent_id?
  const { data: downline, count } = await supabase
    .from('profiles')
    .select('id, username, created_at, role', { count: 'exact' })
    .eq('referring_agent_id', SAVAGE_ID)
    .order('created_at', { ascending: false })
    .limit(20);
  console.log(`Total downline for savagebrands: ${count}`);
  console.log('Downline members:', JSON.stringify(downline, null, 2));

  // Check researcher_referrals table for savagebrands
  const { data: referrals } = await supabase
    .from('researcher_referrals')
    .select('*')
    .eq('referrer_id', SAVAGE_ID)
    .limit(10);
  console.log('researcher_referrals rows:', JSON.stringify(referrals, null, 2));

  // What's the DEFAULT_STORE_SLUG agent ID?
  const { data: houseStore } = await supabase
    .from('agent_profiles')
    .select('id, slug, display_name')
    .eq('slug', 'pepnationlab')
    .maybeSingle();
  console.log('House store:', JSON.stringify(houseStore, null, 2));
}
main().catch(console.error);
