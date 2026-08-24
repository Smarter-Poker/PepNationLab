require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, created_at, status, total')
    .eq('parent_agent_id', 'a860edbe-4171-4dd9-a5e3-1c3905cf71ba'); // I remember this is the UUID for savagebrands
  console.log(data);
}
main();
