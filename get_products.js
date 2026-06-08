require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('products').select('compound_slug, retail_price').in('compound_slug', ['cjc-1295-without-dac', 'ipamorelin', 'cjc-1295-ipa', 'bpc-157', 'tb-500', 'wolverine-stack']);
  console.log(data);
}
run();
