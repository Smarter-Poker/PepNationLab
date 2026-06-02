import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase.rpc('query_policy'); // I can just select from pg_policies via SQL. Let me write a quick raw query via psql... actually I don't have psql access.
  console.log('done');
}
run();
