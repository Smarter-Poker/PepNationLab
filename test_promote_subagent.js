require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const callerId = "ab2327cb-f58c-4e78-8f9e-899a49259f71"; // Adam

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, is_super_agent, is_sub_agent, full_name, username')
    .eq('id', callerId)
    .single();

  console.log("callerProfile:", callerProfile);

  const isPromotingToFullAgent = callerProfile.is_super_agent === true;
  console.log("isPromotingToFullAgent:", isPromotingToFullAgent);
  console.log("is_sub_agent:", !isPromotingToFullAgent);
}

run();
