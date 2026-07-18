require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: bundles } = await supabase.from('bundles').select('*').limit(10);
  console.log("Bundles:");
  console.log(bundles);
  
  const { data: product_bundles } = await supabase.from('product_bundles').select('*').limit(10).catch(()=>({data:null}));
  if (product_bundles) {
      console.log("Product Bundles mapping:");
      console.log(product_bundles);
  }
}

run();
