const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, username, role, full_name')
    .order('created_at', { ascending: false });

  if (error) console.error("Error fetching profiles:", error);
  else console.table(data);
}

checkRoles();
