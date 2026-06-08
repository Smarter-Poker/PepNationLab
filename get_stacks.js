require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('compounds').select('slug, display_name, stack_components').in('slug', ['lipo-c', 'lemon-bottle', 'l-carnitine', 'cagrisema']);
  console.log(data);
}
run();
