import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

// To test RLS, we can't easily impersonate via JS SDK without the user's JWT.
// BUT we established RLS is NOT the problem! If RLS blocked it, error would be null!
// So it MUST be a constraint violation!
// I'll test updating to EXACTLY what they sent, using the service role key.
// If it fails with the service role key, it's a schema issue!

const supabase = createClient(url, key);

async function test() {
  const updates = {
    first_name: 'Mustafa',
    last_name: 'Abuajaj',
    email: 'moose032017490@gmail.com',
    phone: '708-539-2751',
    timezone: 'America/Chicago',
    full_name: 'Mustafa Abuajaj'
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', 'f2b0ede4-0f29-4bfc-9555-bcd3cac5e31f')
    .select()
    .maybeSingle();

  console.log('Update result:', { data, error });
}

test();
