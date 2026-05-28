const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log("2. Testing RLS for savagebrands...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'savagebrands@pepnationlab.com',
    password: 'MyKingDaniel'
  });
  
  if (authError) {
    console.error("Auth Error:", authError);
    return;
  }
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('username, role, full_name, is_super_agent')
    .eq('id', authData.user.id)
    .single();
    
  if (error) {
    console.error("RLS Error:", error);
  } else {
    console.log("Success! Fetched Profile:");
    console.log(profile);
  }
}
verify();
