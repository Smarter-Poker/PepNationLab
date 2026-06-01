import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Find Adam
  const { data: adams } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_super_agent')
    .ilike('full_name', '%adam%');

  console.log('Admins/Super Agents named Adam:', adams);

  for (const adam of adams || []) {
    // Find accounts he created
    const { data: children } = await supabase
      .from('profiles')
      .select('id, full_name, role, is_sub_agent, parent_agent_id')
      .eq('parent_agent_id', adam.id);

    console.log(`\nAccounts under Adam (${adam.id}):`);
    console.table(children);

    for (const child of children || []) {
       const { data: storefront } = await supabase
         .from('agent_profiles')
         .select('slug, store_name')
         .eq('id', child.id)
         .maybeSingle();
       console.log(`Child ${child.full_name} Storefront:`, storefront || 'NONE');
    }
  }
}

main().catch(console.error);
