const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: agent } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', '%savage%');
  console.log('Profiles matching savage:', agent);

  if (agent && agent.length > 0) {
    const { data: ap } = await supabase
      .from('agent_products')
      .select('product_id')
      .eq('agent_id', agent[0].id);
    console.log(`Agent products for ${agent[0].id}:`, ap?.length);
  } else {
    // try agents table?
    const { data: agent2 } = await supabase
      .from('agents')
      .select('*')
      .ilike('name', '%savage%');
    console.log('Agents table matching savage:', agent2);
  }
}
run();
