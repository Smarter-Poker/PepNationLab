import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase.rpc('temp_run_sql', { query: "SELECT jsonb_agg(prosrc) as src FROM pg_proc WHERE proname = 'fn_messenger_support_open'" });
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
run();
