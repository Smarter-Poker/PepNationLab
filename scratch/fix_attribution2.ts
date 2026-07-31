import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixAttribution() {
  const savageBrandsId = '844dca4b-6f01-4779-bc95-bfa1e0809c0c';
  
  const usernamesToUpdate = ['191cab', 'tszaflarski81', 'brianharo75yahoocom'];

  for (const un of usernamesToUpdate) {
    const { data: user } = await supabase.from('profiles').select('id').eq('username', un).single();
    if (!user) {
      console.log(`User not found: ${un}`);
      continue;
    }
    
    const { error } = await supabase.rpc('admin_reassign_researcher', {
      p_researcher_id: user.id,
      p_new_referring_agent_id: savageBrandsId,
      p_new_parent_agent_id: null
    });
      
    if (error) {
       console.error(`Failed to update ${un} via RPC:`, error);
    } else {
       console.log(`Updated ${un} to Savage Brands!`);
    }
  }
}
fixAttribution();
