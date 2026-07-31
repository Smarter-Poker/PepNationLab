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
    const { data, error } = await supabase
      .from('profiles')
      .update({ referring_agent_id: savageBrandsId })
      .eq('username', un)
      .select('username, referring_agent_id');
      
    if (error) {
       console.error(`Failed to update ${un}:`, error);
    } else {
       console.log(`Updated ${un}:`, data);
    }
  }
}
fixAttribution();
