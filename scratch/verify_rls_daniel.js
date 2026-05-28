const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function verify() {
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  
  // 1. Generate magic link for Daniel
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: 'daniel@bekavactrading.com',
  });
  
  if (linkError) {
    console.error("Link Error:", linkError);
    return;
  }
  
  // 2. Parse token hash from link
  const url = new URL(linkData.properties.action_link);
  const token_hash = url.searchParams.get('token_hash');
  
  // 3. Verify OTP as anon client to get session
  const { data: authData, error: authError } = await anonClient.auth.verifyOtp({
    token_hash,
    type: 'magiclink'
  });
  
  if (authError) {
    console.error("Auth Error:", authError);
    return;
  }
  
  // 4. Test RLS
  const { data: profile, error } = await anonClient
    .from('profiles')
    .select('role, full_name')
    .eq('id', authData.user.id)
    .single();
    
  console.log("RLS Result for Daniel:", { profile, error });
}
verify();
