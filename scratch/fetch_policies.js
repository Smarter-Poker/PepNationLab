const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function fetchPolicies() {
  const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await response.json();
  console.log(Object.keys(data.definitions));
}
fetchPolicies();
