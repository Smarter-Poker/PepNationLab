require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const query = `
    ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
    UPDATE public.profiles SET email = NULL WHERE email LIKE '%@internal.auth';
    UPDATE public.profiles SET email = NULL WHERE email LIKE '%@pepnationlab.com' AND email NOT IN ('daniel@pepnationlab.com', 'admin@pepnationlab.com', 'support@pepnationlab.com', 'research@pepnationlab.com');
  `;
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/query_db`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({ query })
  });
  const text = await res.text();
  console.log("DB RPC Response:", res.status, text);
}
run();
