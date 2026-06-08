require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('products').select('name, compound_slug, description').in('compound_slug', ['cagrisema', 'cjc-ipamorelin', 'bpc-tb']);
  console.log(data);
}
run();
