import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('query_triggers', { table_name: 'orders' }).catch(() => ({ data: 'RPC query_triggers not found' }));
  console.log('Triggers:', data);
}
run();
