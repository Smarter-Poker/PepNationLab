const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixUsername() {
  const email = "shipping@pepnationlab.com";
  
  const { data, error } = await supabase
    .from('profiles')
    .update({ username: 'shipping' })
    .eq('email', email);

  if (error) console.error("Error updating username:", error);
  else console.log("✅ Fixed Shipping username");
}

fixUsername();
