import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const buyerId = '2db791ef-00fe-43b5-af40-e8c07c93fe1f';
  // Simulate api/orders/route.ts logic exactly
  
  const { data: profile } = await supabase.from('profiles').select('id, referring_agent_id, role, tier, parent_agent_id').eq('id', buyerId).single();
  console.log('Profile:', profile);
  
  let agentProfile = null;
  let isAgentSelfBuy = false;
  if (profile.referring_agent_id) {
    const { data: ap } = await supabase.from('profiles').select('id, tier, parent_agent_id').eq('id', profile.referring_agent_id).single();
    agentProfile = ap;
  }
  
  console.log('agentProfile:', agentProfile);
  console.log('isAgentSelfBuy:', isAgentSelfBuy);
  console.log('agent_id to insert:', agentProfile && !isAgentSelfBuy ? agentProfile.id : null);
}
run();
