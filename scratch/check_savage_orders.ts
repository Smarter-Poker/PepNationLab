import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, total, status, created_at, buyer_name')
    .eq('agent_id', '844dca4b-6f01-4779-bc95-bfa1e0809c0c')
    .gte('created_at', '2026-07-13')
    .lte('created_at', '2026-07-19');
  console.log("Orders:", orders, error);
}

run();
