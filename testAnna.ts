import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data } = await supabase.from('profiles').select('*').ilike('full_name', '%anna%');
  console.log("Anna profiles:", data);
  const { data: agentData } = await supabase.from('agent_profiles').select('*').in('id', data?.map(d => d.id) || []);
  console.log("Anna agent_profiles:", agentData);
}
run();
