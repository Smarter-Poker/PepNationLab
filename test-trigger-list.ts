import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('profiles').insert({
    id: '11111111-1111-1111-1111-111111111111',
    email: 'test2@internal.auth',
    full_name: 'test',
    first_name: 'test',
    last_name: null,
    role: 'pending'
  });
  console.log('Direct Insert Pending Role Error:', error);
}
run();
