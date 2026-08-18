import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: stmts, error } = await supabase.rpc('get_statement_orders', { p_statement_id: '68e92bb1-8c96-4971-beb1-e054c5f0d54e' });
  console.log("RPC:", stmts, error);
}

run();
