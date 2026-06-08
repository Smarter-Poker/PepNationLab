const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('products')
    .select('product_name, compound_slug')
    .ilike('product_name', '%Lipo%');
  console.log('Lipo:', data);

  const { data: data2 } = await supabase
    .from('products')
    .select('product_name, compound_slug')
    .ilike('product_name', '%Carnitine%');
  console.log('Carnitine:', data2);

  const { data: data3 } = await supabase
    .from('products')
    .select('product_name, compound_slug')
    .ilike('product_name', '%Wolverine%');
  console.log('Wolverine:', data3);

  const { data: data4 } = await supabase
    .from('products')
    .select('product_name, compound_slug')
    .ilike('product_name', '%BPC%TB%');
  console.log('BPC TB:', data4);
}
check();
