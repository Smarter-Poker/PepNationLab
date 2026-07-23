const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  // Try to reassign an existing researcher who is assigned to house store
  // Find a researcher assigned to house store
  const { data: user } = await supabase.from('profiles').select('id').eq('role', 'researcher').eq('referring_agent_id', 'b8bd12e6-8196-401e-b37b-f742caf1596c').limit(1).single();
  if (user) {
    console.log("Found user:", user.id);
    const { data, error } = await supabase.rpc('apply_signup_referral', { p_referee_id: user.id, p_code: 'savagebrands' });
    console.log("Result:", data, "Error:", error);
  }
}
run();
