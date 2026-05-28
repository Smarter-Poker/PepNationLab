const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShipping() {
  const email = "shipping@pepnationlab.com";
  
  const { data, error } = await supabase
    .from('profiles')
    .select('username, email')
    .eq('email', email)
    .single();

  if (error) console.error("Error fetching shipping user:", error);
  else console.log("Shipping User:", data);
}

checkShipping();
