import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('profiles').insert({
    id: '22222222-2222-2222-2222-222222222222',
    email: 'test3@internal.auth',
    full_name: 'test',
    first_name: 'test',
    last_name: null,
    role: 'researcher'
  });
  console.log('Direct Insert Researcher Role Error:', error);
}
run();
