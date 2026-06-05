const { createClient } = require('@supabase/supabase-base' || '@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = require('@supabase/supabase-js').createClient(url, key);

async function main() {
  // Let's get all agent products and their linked products
  const { data, error } = await supabase
    .from('agent_products')
    .select(`
      id,
      product_id,
      custom_name,
      products (
        name,
        category
      )
    `)
    .eq('is_visible', true);

  if (error) {
    console.error("Error fetching agent products:", error);
    return;
  }

  console.log("Active Storefront Products in DB:");
  const uniqueNames = new Set();
  data.forEach(item => {
    const name = item.products?.name;
    const cat = item.products?.category;
    if (name) {
      uniqueNames.add(`${name} [Category: ${cat}]`);
    }
  });

  Array.from(uniqueNames).sort().forEach(n => console.log(" -", n));
}

main();
