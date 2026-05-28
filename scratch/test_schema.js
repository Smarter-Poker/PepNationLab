const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('products').select('admin_bulk_price').limit(1);
  if (error) {
    console.error("SQL Error:", error.message);
  } else {
    console.log("Success! products.admin_bulk_price exists.");
  }
}
test();
