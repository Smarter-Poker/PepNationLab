const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log("3. Testing RLS for admin...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'daniel@bekavactrading.com',
    password: '215SlalomCt!'
  });
  
  if (authError) {
    console.error("Auth Error (Check Password):", authError);
    return;
  }
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('username, role, full_name')
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
