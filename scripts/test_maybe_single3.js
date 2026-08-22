import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase
    .from('profiles')
    .update({ first_name: 'Test' })
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .maybeSingle();
    
  console.log('data:', data);
  console.log('error:', error);
}

test();
