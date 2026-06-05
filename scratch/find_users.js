const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function find() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Users:", users.map(u => ({ id: u.id, email: u.email, user_metadata: u.user_metadata })).slice(0, 10));
  }
}
find();
