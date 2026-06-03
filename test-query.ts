import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('get_triggers_debug');
  if (error) {
    // try direct SQL if we had an endpoint, but we don't. Let's just insert a profile manually and see the error!
    console.log('Inserting profile directly...');
    const { data: pData, error: pError } = await supabase.from('profiles').insert({
      id: '00000000-0000-0000-0000-000000000000',
      email: 'test@internal.auth',
      full_name: '',
      first_name: '',
      last_name: null,
      role: 'researcher'
    });
    console.log('Direct Insert Error:', pError);
  }
}
run();
