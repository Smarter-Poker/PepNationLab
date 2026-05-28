const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.rpc('update_agent_inventory', {
    p_agent_id: '123e4567-e89b-12d3-a456-426614174000',
    p_product_id: '123e4567-e89b-12d3-a456-426614174000',
    p_quantity: 1
  });
  console.log("RPC Error:", error ? error.message : "None");
}
test();
