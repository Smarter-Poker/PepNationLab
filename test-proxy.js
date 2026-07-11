require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function test() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const email = 'test-agent-1783781631489@pepnationlab.com';
  const password = 'TestAgentPassword123!';
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.error('Login failed:', authError);
    return;
  }

  const session = authData.session;
  console.log('Got session token!');

  const projectRef = supabaseUrl.split('//')[1].split('.')[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = JSON.stringify([
    session.access_token,
    session.refresh_token,
    session.provider_token,
    session.provider_refresh_token
  ]);

  const url = encodeURIComponent('https://example.com');
  const res = await fetch(`https://pepnationlab.com/api/proxy?url=${url}`, {
    headers: {
      cookie: `${cookieName}=${encodeURIComponent(cookieValue)}`
    }
  });

  console.log('Status:', res.status);
  const csp = res.headers.get('content-security-policy');
  console.log('CSP:', csp);
  const text = await res.text();
  console.log('Body snippet:', text.substring(0, 500));
}

test();
