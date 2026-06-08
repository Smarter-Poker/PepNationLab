const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data } = await supabase
    .from('products')
    .select('product_name, compound_slug, image_url')
    .in('compound_slug', ['lemon-bottle', 'l-carnitine', 'lipo-c']);
  console.log(data);
}
check();
