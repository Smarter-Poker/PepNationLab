const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function verify() {
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: linkData } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: 'daniel@bekavactrading.com',
  });
  console.log(linkData.properties.action_link);
}
verify();
