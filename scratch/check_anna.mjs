import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: users } = await supabase.from('profiles').select('*').ilike('full_name', '%anna%');
  console.log('Anna users:', users);

  if (users?.length > 0) {
    const { data: orders } = await supabase.from('orders').select('*').in('buyer_id', users.map(u => u.id));
    console.log('Anna orders:', orders);
  }

  const { data: savage } = await supabase.from('profiles').select('id, username').eq('username', 'savagebrands');
  console.log('Savagebrands agent:', savage);
}
run();
