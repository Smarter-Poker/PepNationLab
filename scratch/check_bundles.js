const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('products').select('id, name, category, is_bundle, type').limit(100);
  const bundles = data.filter(p => p.is_bundle || p.category === 'Bundles & Stacks' || p.type === 'bundle' || p.name.toLowerCase().includes('bundle'));
  console.log("Found bundles:", bundles.length);
  if (bundles.length > 0) {
    console.log(bundles[0]);
  }
}

run();
