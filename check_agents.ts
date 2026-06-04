import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: agents, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, role, tier, commission_pct, agent_profiles(id), agent_products(count)')
    .in('role', ['agent', 'super_agent']);
    
  if (error) {
    console.error(error);
    return;
  }
  
  let missingProfiles = 0;
  let missingProducts = 0;
  
  for (const agent of agents) {
    const hasProfile = Array.isArray(agent.agent_profiles) ? agent.agent_profiles.length > 0 : !!agent.agent_profiles;
    const productCount = agent.agent_products[0]?.count || 0;
    
    if (!hasProfile) {
      console.log(`[Missing Profile] Agent ${agent.username} (${agent.id})`);
      missingProfiles++;
    }
    if (productCount === 0) {
      console.log(`[Missing Products] Agent ${agent.username} (${agent.id})`);
      missingProducts++;
    }
  }
  
  console.log(`\nTotal Agents: ${agents.length}`);
  console.log(`Missing Profiles: ${missingProfiles}`);
  console.log(`Missing Products: ${missingProducts}`);
}

run();
