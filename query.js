const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('agent_profiles').select('*').eq('slug', 'savagebrands').maybeSingle();
  console.log(data);
  const { data: p } = await supabase.from('profiles').select('username, referral_code').eq('username', 'savagebrands').maybeSingle();
  console.log(p);
}
run();
