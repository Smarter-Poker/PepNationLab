import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function test() {
  // Let's create a temporary user and test a WITH CHECK violation?
  // Service role bypasses RLS. So I can't test it easily.
}
test();
