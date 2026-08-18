import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: stmts, error } = await supabase
    .from('weekly_statements')
    .select('*')
    .eq('agent_id', '844dca4b-6f01-4779-bc95-bfa1e0809c0c') // Savage Brands
  console.log("Statements:", stmts);
}

run();
