const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('agent_profiles')
    .select('slug, payment_handles')
    .eq('slug', 'anna')
    .single();

  console.log("Anna's payment_handles:", JSON.stringify(data?.payment_handles, null, 2));
}

run();
