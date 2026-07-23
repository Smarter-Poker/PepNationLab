const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: user } = await supabase.from('profiles').select('id').eq('role', 'researcher').eq('referring_agent_id', 'b8bd12e6-8196-401e-b37b-f742caf1596c').order('created_at', { ascending: false }).limit(1).single();
  if (user) {
    console.log("Found fresh user:", user.id);
    const { data, error } = await supabase.rpc('oauth_link_fresh_referral', { p_user_id: user.id, p_agent_id: '844dca4b-6f01-4779-bc95-bfa1e0809c0c' });
    console.log("Result:", data, "Error:", error);
  }
}
run();
