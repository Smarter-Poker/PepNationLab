import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('temp_run_sql', {
    query: `
      SELECT json_agg(json_build_object('table_name', c.relname))
      FROM pg_class c
      LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
      WHERE c.relnamespace = 'public'::regnamespace
        AND c.relkind = 'r'
        AND c.relrowsecurity = true
        AND p.policyname IS NULL;
    `
  });
  console.log("Tables with RLS enabled but NO policies:");
  console.log(JSON.stringify(data, null, 2));
}
run();
