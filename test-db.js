const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data: bundles, error } = await supabase.from('storefront_bundles').select('*');
  console.log(error || bundles.map(b => b.vial_image_url));
}
test();
