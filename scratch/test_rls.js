const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRLS() {
  const email = "savagebrands@pepnationlab.com";
  const password = "MyKingDaniel";
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (authError) {
    console.error("Auth Error:", authError);
    return;
  }
  console.log("Logged in:", authData.user.id);
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();
    
  if (error) console.error("RLS Error:", error);
  else console.log("Profile fetched:", !!profile, "Role:", profile.role);
}
testRLS();
