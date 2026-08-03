import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function check() {
  const { data, error } = await supabase.from('profiles').select('email, role, is_super_agent, is_manufacturer').in('role', ['admin', 'super_agent', 'agent']).limit(10);
  console.log(data);
}
check();
