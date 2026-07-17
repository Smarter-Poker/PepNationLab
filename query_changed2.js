require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabase.from('products').select('name, image_url');
  const originals = data.filter(p => !p.image_url.startsWith('/images/products/') && !p.image_url.startsWith('/images/savage-brands/'));
  console.log('Other prefixes:', originals.map(p => p.image_url));
}
run();
