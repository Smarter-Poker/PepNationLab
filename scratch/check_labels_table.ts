import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data, error } = await supabase.from('print_labels').select('*').limit(5);
  console.log("print_labels:", data, error);
  const { data: d2, error: e2 } = await supabase.from('product_labels').select('*').limit(5);
  console.log("product_labels:", d2, e2);
}
check();
