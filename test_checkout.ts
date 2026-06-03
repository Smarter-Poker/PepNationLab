import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('temp_run_sql', {
    query: `
      SELECT json_build_object('def', pg_get_functiondef(oid))
      FROM pg_proc
      WHERE proname = 'place_order'
    `
  });
  console.log(JSON.stringify(data, null, 2));
}
run();
