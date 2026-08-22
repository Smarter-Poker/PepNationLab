import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, referral_code, role, is_super_agent, referring_agent_id')
    .ilike('username', '%savage%')
    .limit(5);
  console.log('Profiles matching "savage":', JSON.stringify(profiles, null, 2));

  const { data: agentProfiles } = await supabase
    .from('agent_profiles')
    .select('id, slug, display_name')
    .ilike('slug', '%savage%')
    .limit(5);
  console.log('Agent profiles matching "savage":', JSON.stringify(agentProfiles, null, 2));

  // Also check recent signups to see what referring_agent_id they got
  const { data: recent } = await supabase
    .from('profiles')
    .select('id, username, created_at, referring_agent_id, role')
    .eq('role', 'researcher')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('Recent researcher signups:', JSON.stringify(recent, null, 2));
}
main().catch(console.error);
