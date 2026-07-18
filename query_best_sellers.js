require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Try to find best selling by sales or just get all products
  const { data: products, error } = await supabase
    .from('products')
    .select('*, product_variants(*)');
    
  if (error) {
    console.error("Error fetching products:", error);
    return;
  }
  
  console.log("Total products:", products.length);
  // Just print the first few to see schema
  console.log("Sample:", JSON.stringify(products[0], null, 2));
}

run();
