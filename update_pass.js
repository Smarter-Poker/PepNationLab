const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.auth.admin.updateUserById('844dca4b-6f01-4779-bc95-bfa1e0809c0c', {
    password: 'Pepnation123!'
  });
  console.log(error || 'Success');
}
run();
