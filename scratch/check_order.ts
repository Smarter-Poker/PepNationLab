import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', '3c004a00-b1f5-4d77-a5ff-0c85e44e07e4');
  console.log('Order Items:', data);
  console.log('Error:', error);
}

check();
