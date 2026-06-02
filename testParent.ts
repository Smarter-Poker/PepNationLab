import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data } = await supabase.from('profiles').select('*').eq('id', '844dca4b-6f01-4779-bc95-bfa1e0809c0c');
  console.log("Parent profile:", data);
}
run();
